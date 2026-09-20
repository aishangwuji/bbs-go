package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// 准入门槛常量
const (
	MinAccountAgeDays = 180
	MinRepoStars      = 1000
)

// EvaluatorResult GitHub 开发者画像评估结果
type EvaluatorResult struct {
	ID              int64           `json:"id"`
	Login           string          `json:"login"`
	Name            string          `json:"name"`
	AvatarURL       string          `json:"avatarUrl"`
	Bio             string          `json:"bio"`
	CreatedAt       time.Time       `json:"createdAt"`
	CreatedAtMs     int64           `json:"createdAtMs"`
	AccountAgeDays  int             `json:"accountAgeDays"`
	PublicRepos     int             `json:"publicRepos"`
	Followers       int             `json:"followers"`
	TopRepo         RepoInfo        `json:"topRepo"`
	ContributedPR   ContributedPR   `json:"contributedPr"`
	PassedAdmission bool            `json:"passedAdmission"`
	ProofType       string          `json:"proofType"`   // repo_owner | contributor_merged_pr | account_age | none
	ProofReason     string          `json:"proofReason"` // 中文评定说明
	RawJSON         string          `json:"-"`
}

// RepoInfo 仓库概要信息
type RepoInfo struct {
	FullName    string `json:"fullName"`
	Stars       int    `json:"stars"`
	HTMLURL     string `json:"htmlUrl"`
	Language    string `json:"language"`
	Description string `json:"description"`
}

// ContributedPR 贡献的合并 PR 概要信息
type ContributedPR struct {
	RepoFullName string `json:"repoFullName"`
	Stars        int    `json:"stars"`
	PRTitle      string `json:"prTitle"`
	PRURL        string `json:"prUrl"`
}

type ghSearchReposResp struct {
	TotalCount int `json:"total_count"`
	Items      []struct {
		FullName        string `json:"full_name"`
		StargazersCount int    `json:"stargazers_count"`
		HTMLURL         string `json:"html_url"`
		Language        string `json:"language"`
		Description     string `json:"description"`
	} `json:"items"`
}

type ghSearchIssuesResp struct {
	TotalCount int `json:"total_count"`
	Items      []struct {
		Title         string `json:"title"`
		HTMLURL       string `json:"html_url"`
		RepositoryURL string `json:"repository_url"`
	} `json:"items"`
}

type ghRepoDetailResp struct {
	FullName        string `json:"full_name"`
	StargazersCount int    `json:"stargazers_count"`
	HTMLURL         string `json:"html_url"`
}

type ghUserDetailResp struct {
	ID          int64  `json:"id"`
	Login       string `json:"login"`
	Name        string `json:"name"`
	AvatarURL   string `json:"avatar_url"`
	Bio         string `json:"bio"`
	CreatedAt   string `json:"created_at"`
	PublicRepos int    `json:"public_repos"`
	Followers   int    `json:"followers"`
}

// EvaluateUserGithub 使用用户的 access_token 调用 GitHub API 执行准入与画像评估
func EvaluateUserGithub(ctx context.Context, accessToken string, fallbackLogin string) (*EvaluatorResult, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	// 步骤 1：获取用户基础资料
	user, err := fetchUserDetail(ctx, client, accessToken, fallbackLogin)
	if err != nil {
		return nil, fmt.Errorf("fetch github user detail error: %w", err)
	}

	createdTime, _ := time.Parse(time.RFC3339, user.CreatedAt)
	accountAgeDays := 0
	if !createdTime.IsZero() {
		accountAgeDays = int(time.Since(createdTime).Hours() / 24)
	}

	result := &EvaluatorResult{
		ID:             user.ID,
		Login:          user.Login,
		Name:           user.Name,
		AvatarURL:      user.AvatarURL,
		Bio:            user.Bio,
		CreatedAt:      createdTime,
		CreatedAtMs:    createdTime.UnixMilli(),
		AccountAgeDays: accountAgeDays,
		PublicRepos:    user.PublicRepos,
		Followers:      user.Followers,
		ProofType:      "none",
	}

	// 步骤 2：获取用户名下最高 Star 仓库
	topRepo, err := fetchTopRepo(ctx, client, accessToken, user.Login)
	if err == nil && topRepo != nil {
		result.TopRepo = *topRepo
	}

	// 步骤 3：获取用户贡献且已合并的 PR
	contributedPR, err := fetchTopMergedPR(ctx, client, accessToken, user.Login)
	if err == nil && contributedPR != nil {
		result.ContributedPR = *contributedPR
	}

	// 步骤 4：准入规则多轨评估（任一满足即为达成）：
	// 1. 拥有 1k+ Star 仓库 (repo_owner)
	// 2. 贡献合并 PR 至 1k+ Star 仓库 (contributor_merged_pr)
	// 3. 账号注册满 180 天 (account_age)
	if result.TopRepo.Stars >= MinRepoStars {
		result.PassedAdmission = true
		result.ProofType = "repo_owner"
		result.ProofReason = fmt.Sprintf("1k+ Star 仓库所有者 (%s, %d★)", result.TopRepo.FullName, result.TopRepo.Stars)
	} else if result.ContributedPR.Stars >= MinRepoStars {
		result.PassedAdmission = true
		result.ProofType = "contributor_merged_pr"
		result.ProofReason = fmt.Sprintf("向 1k+ Star 仓库贡献合并 PR (%s, %d★)", result.ContributedPR.RepoFullName, result.ContributedPR.Stars)
	} else if result.AccountAgeDays >= MinAccountAgeDays {
		result.PassedAdmission = true
		result.ProofType = "account_age"
		result.ProofReason = fmt.Sprintf("GitHub 账号注册满 %d 天（已 %d 天）", MinAccountAgeDays, result.AccountAgeDays)
	} else {
		result.PassedAdmission = false
		result.ProofType = "none"
		result.ProofReason = fmt.Sprintf("未达成 180 天注册站龄或 1k+ Star 贡献（当前站龄 %d 天）", result.AccountAgeDays)
	}

	if raw, err := json.Marshal(result); err == nil {
		result.RawJSON = string(raw)
	}

	return result, nil
}

func doGHRequest(ctx context.Context, client *http.Client, accessToken, url string, target interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "bbs-go-github-evaluator/1.0")
	if strings.TrimSpace(accessToken) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d, body: %s", resp.StatusCode, string(body))
	}

	return json.Unmarshal(body, target)
}

func fetchUserDetail(ctx context.Context, client *http.Client, accessToken, fallbackLogin string) (*ghUserDetailResp, error) {
	url := "https://api.github.com/user"
	if strings.TrimSpace(accessToken) == "" && strings.TrimSpace(fallbackLogin) != "" {
		url = fmt.Sprintf("https://api.github.com/users/%s", fallbackLogin)
	}

	var detail ghUserDetailResp
	if err := doGHRequest(ctx, client, accessToken, url, &detail); err != nil {
		return nil, err
	}
	return &detail, nil
}

func fetchTopRepo(ctx context.Context, client *http.Client, accessToken, login string) (*RepoInfo, error) {
	url := fmt.Sprintf("https://api.github.com/search/repositories?q=user:%s+fork:false&sort=stars&per_page=1", login)
	var resp ghSearchReposResp
	if err := doGHRequest(ctx, client, accessToken, url, &resp); err != nil {
		slog.Warn("fetch top repo error", slog.Any("login", login), slog.Any("err", err))
		return nil, err
	}
	if resp.TotalCount == 0 || len(resp.Items) == 0 {
		return nil, nil
	}
	item := resp.Items[0]
	return &RepoInfo{
		FullName:    item.FullName,
		Stars:       item.StargazersCount,
		HTMLURL:     item.HTMLURL,
		Language:    item.Language,
		Description: item.Description,
	}, nil
}

func fetchTopMergedPR(ctx context.Context, client *http.Client, accessToken, login string) (*ContributedPR, error) {
	url := fmt.Sprintf("https://api.github.com/search/issues?q=is:pr+is:merged+author:%s&sort=updated&order=desc&per_page=5", login)
	var resp ghSearchIssuesResp
	if err := doGHRequest(ctx, client, accessToken, url, &resp); err != nil {
		slog.Warn("fetch top merged PR error", slog.Any("login", login), slog.Any("err", err))
		return nil, err
	}
	if resp.TotalCount == 0 || len(resp.Items) == 0 {
		return nil, nil
	}

	for _, item := range resp.Items {
		if strings.TrimSpace(item.RepositoryURL) == "" {
			continue
		}
		var repoDetail ghRepoDetailResp
		if err := doGHRequest(ctx, client, accessToken, item.RepositoryURL, &repoDetail); err != nil {
			continue
		}
		if repoDetail.StargazersCount >= MinRepoStars {
			return &ContributedPR{
				RepoFullName: repoDetail.FullName,
				Stars:        repoDetail.StargazersCount,
				PRTitle:      item.Title,
				PRURL:        item.HTMLURL,
			}, nil
		}
	}

	return nil, nil
}
