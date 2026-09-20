package services

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/github"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

var UserGithubProfileService = newUserGithubProfileService()

func newUserGithubProfileService() *userGithubProfileService {
	return &userGithubProfileService{}
}

type userGithubProfileService struct{}

func (s *userGithubProfileService) GetByUserId(userId int64) *models.UserGithubProfile {
	return repositories.UserGithubProfileRepository.GetByUserId(sqls.DB(), userId)
}

// SyncProfile 执行画像同步、准入评估与勋章授予
func (s *userGithubProfileService) SyncProfile(userId int64, accessToken string, fallbackLogin string) (*models.UserGithubProfile, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	evalResult, err := github.EvaluateUserGithub(ctx, accessToken, fallbackLogin)
	if err != nil {
		slog.Error("evaluate github profile failed", slog.Int64("userId", userId), slog.Any("err", err))
		return nil, err
	}

	now := dates.NowTimestamp()
	profile := repositories.UserGithubProfileRepository.GetByUserId(sqls.DB(), userId)
	if profile == nil {
		profile = &models.UserGithubProfile{
			UserId:     userId,
			CreateTime: now,
		}
	}

	profile.GithubId = evalResult.ID
	profile.GithubLogin = evalResult.Login
	profile.GithubName = evalResult.Name
	profile.GithubAvatar = evalResult.AvatarURL
	profile.GithubBio = evalResult.Bio
	profile.GithubCreatedAt = evalResult.CreatedAtMs
	profile.AccountAgeDays = evalResult.AccountAgeDays
	profile.PublicRepos = evalResult.PublicRepos
	profile.Followers = evalResult.Followers

	profile.TopRepoName = evalResult.TopRepo.FullName
	profile.TopRepoStars = evalResult.TopRepo.Stars
	profile.TopRepoUrl = evalResult.TopRepo.HTMLURL
	profile.TopRepoLang = evalResult.TopRepo.Language
	profile.TopRepoDesc = evalResult.TopRepo.Description

	profile.ContributedRepoName = evalResult.ContributedPR.RepoFullName
	profile.ContributedRepoStars = evalResult.ContributedPR.Stars
	profile.ContributedPrTitle = evalResult.ContributedPR.PRTitle
	profile.ContributedPrUrl = evalResult.ContributedPR.PRURL

	if len(evalResult.MergedPRs) > 0 {
		if rawPrs, err := json.Marshal(evalResult.MergedPRs); err == nil {
			profile.MergedPrs = string(rawPrs)
		}
		if profile.SelectedPrUrl == "" {
			profile.SelectedPrUrl = evalResult.MergedPRs[0].PRURL
		}
	}

	profile.PassedAdmission = evalResult.PassedAdmission
	profile.ProofType = evalResult.ProofType
	profile.ProofReason = evalResult.ProofReason
	profile.RawData = evalResult.RawJSON
	profile.SyncedAt = now
	profile.UpdateTime = now

	if profile.Id > 0 {
		if err := repositories.UserGithubProfileRepository.Update(sqls.DB(), profile); err != nil {
			return nil, err
		}
	} else {
		if err := repositories.UserGithubProfileRepository.Create(sqls.DB(), profile); err != nil {
			return nil, err
		}
	}

	// 勋章联动授予（若满足准入/成就）
	s.grantBadgesIfEligible(userId, evalResult)

	return profile, nil
}

// SelectPR 用户自主选择在个人主页代表作展示的合并 PR
func (s *userGithubProfileService) SelectPR(userId int64, prUrl string) (*models.UserGithubProfile, error) {
	profile := s.GetByUserId(userId)
	if profile == nil {
		return nil, errors.New("github profile not found")
	}
	prUrl = strings.TrimSpace(prUrl)
	if prUrl != "" {
		// 校验该 PR 是否在候选 PR 列表中
		var prs []github.ContributedPR
		if err := json.Unmarshal([]byte(profile.MergedPrs), &prs); err == nil && len(prs) > 0 {
			matched := false
			for _, p := range prs {
				if p.PRURL == prUrl {
					matched = true
					profile.ContributedRepoName = p.RepoFullName
					profile.ContributedRepoStars = p.Stars
					profile.ContributedPrTitle = p.PRTitle
					profile.ContributedPrUrl = p.PRURL
					break
				}
			}
			if !matched {
				return nil, errors.New("选定的 PR 不在合格开源贡献列表中")
			}
		}
		profile.SelectedPrUrl = prUrl
	}
	profile.UpdateTime = dates.NowTimestamp()
	if err := repositories.UserGithubProfileRepository.Update(sqls.DB(), profile); err != nil {
		return nil, err
	}
	return profile, nil
}

// AsyncSyncProfile 异步抓取并落库（带 Recover 保护与超时控制，不阻断主流程）
func (s *userGithubProfileService) AsyncSyncProfile(userId int64, accessToken string, fallbackLogin string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("async sync github profile panic", slog.Any("recover", r))
			}
		}()

		if _, err := s.SyncProfile(userId, accessToken, fallbackLogin); err != nil {
			slog.Warn("async sync github profile failed", slog.Int64("userId", userId), slog.Any("err", err))
		}
	}()
}

// grantBadgesIfEligible 根据评估结果自动授予社区成就勋章
func (s *userGithubProfileService) grantBadgesIfEligible(userId int64, eval *github.EvaluatorResult) {
	_ = sqls.WithTransaction(func(txCtx *sqls.TxContext) error {
		// 1. GitHub 开发者勋章（账号满 180 天 或 准入通过）
		if eval.PassedAdmission || eval.AccountAgeDays >= github.MinAccountAgeDays {
			badge := s.ensureBadge(txCtx, "github_developer", "GitHub 开发者", "通过 GitHub 准入认证并关联社区账号", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg")
			if badge != nil {
				_ = UserBadgeService.Give(txCtx, userId, badge.Id, "github_admission", eval.Login)
			}
		}

		// 2. 1k+ Star 仓库作者勋章
		if eval.TopRepo.Stars >= github.MinRepoStars {
			badge := s.ensureBadge(txCtx, "github_star_owner", "1k+ Star 开源作者", "在 GitHub 拥有 1,000+ Stars 开源代表作", "")
			if badge != nil {
				_ = UserBadgeService.Give(txCtx, userId, badge.Id, "github_star_owner", eval.TopRepo.FullName)
			}
		}

		// 3. 顶级开源贡献者勋章
		if eval.ContributedPR.Stars >= github.MinRepoStars {
			badge := s.ensureBadge(txCtx, "github_contributor", "顶级开源贡献者", "向 1,000+ Stars 知名开源项目贡献合并 PR", "")
			if badge != nil {
				_ = UserBadgeService.Give(txCtx, userId, badge.Id, "github_contributor", eval.ContributedPR.RepoFullName)
			}
		}

		return nil
	})
}

// ensureBadge 确保勋章存在（若不存在则自动初始化入库）
func (s *userGithubProfileService) ensureBadge(ctx *sqls.TxContext, name, title, description, icon string) *models.Badge {
	badge := repositories.BadgeRepository.Take(ctx.Tx, "name = ?", name)
	if badge != nil {
		return badge
	}

	newBadge := &models.Badge{
		Name:        name,
		Title:       title,
		Description: description,
		Icon:        icon,
		SortNo:      10,
		Status:      constants.StatusOk,
		GrantType:   "auto",
		RuleField:   "github_proof",
		RuleValue:   1,
		CreateTime:  dates.NowTimestamp(),
		UpdateTime:  dates.NowTimestamp(),
	}
	if err := repositories.BadgeRepository.Create(ctx.Tx, newBadge); err != nil {
		return nil
	}
	return newBadge
}
