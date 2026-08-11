package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"

	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"bbs-go/internal/pkg/params"
	"bbs-go/internal/repositories"

	"github.com/mlogclub/simple/common/dates"
	"github.com/mlogclub/simple/sqls"
)

var AgentTokenService = newAgentTokenService()

func newAgentTokenService() *agentTokenService {
	return &agentTokenService{}
}

type agentTokenService struct {
}

// HashToken 将令牌明文哈希为固定长度摘要。库中与日志中只允许出现哈希值，禁止明文（规则18）。
func (s *agentTokenService) HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// GenerateToken 生成一个高熵随机令牌明文（仅创建时展示一次）。
func (s *agentTokenService) GenerateToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func (s *agentTokenService) Get(id int64) *models.AgentToken {
	return repositories.AgentTokenRepository.Get(sqls.DB(), id)
}

func (s *agentTokenService) Take(where ...interface{}) *models.AgentToken {
	return repositories.AgentTokenRepository.Take(sqls.DB(), where...)
}

func (s *agentTokenService) FindPageByParams(params *params.QueryParams) (list []models.AgentToken, paging *sqls.Paging) {
	return repositories.AgentTokenRepository.FindPageByParams(sqls.DB(), params)
}

func (s *agentTokenService) Create(t *models.AgentToken) error {
	return repositories.AgentTokenRepository.Create(sqls.DB(), t)
}

func (s *agentTokenService) Update(t *models.AgentToken) error {
	return repositories.AgentTokenRepository.Update(sqls.DB(), t)
}

func (s *agentTokenService) Delete(id int64) {
	repositories.AgentTokenRepository.Delete(sqls.DB(), id)
	repositories.AgentTokenRepository.DeleteApisByTokenId(sqls.DB(), id)
}

func (s *agentTokenService) GetByTokenHash(hash string) *models.AgentToken {
	return repositories.AgentTokenRepository.Take(sqls.DB(), "token_hash = ?", hash)
}

// IsValid 判断令牌当前是否可用：存在、状态正常、未过期。
func (s *agentTokenService) IsValid(at *models.AgentToken) bool {
	if at == nil || at.Status != constants.StatusOk {
		return false
	}
	if at.ExpiredAt > 0 && at.ExpiredAt < dates.NowTimestamp() {
		return false
	}
	return true
}

// TouchLastUsed 记录最近调用时间，失败不影响主流程（可观测性，非关键路径）。
func (s *agentTokenService) TouchLastUsed(id int64) {
	if id <= 0 {
		return
	}
	_ = repositories.AgentTokenRepository.UpdateColumn(sqls.DB(), id, "last_used_at", dates.NowTimestamp())
}

// GetGrantedApis 返回令牌已授权的全部能力（白名单）。
func (s *agentTokenService) GetGrantedApis(tokenId int64) []models.AgentTokenApi {
	return repositories.AgentTokenRepository.FindApisByTokenId(sqls.DB(), tokenId)
}

// HasCapability 白名单命中判断。method/path 为管理端路由模板（如 POST /api/admin/topic/list）。
func (s *agentTokenService) HasCapability(tokenId int64, method, path string) bool {
	if tokenId <= 0 {
		return false
	}
	return repositories.AgentTokenRepository.HasApi(sqls.DB(), tokenId, method, path)
}

// GrantApis 整体替换某令牌的能力白名单（事务）。传入的能力必须已在注册表中且经 handler 校验。
func (s *agentTokenService) GrantApis(tokenId int64, apis []models.AgentTokenApi) error {
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.Where("token_id = ?", tokenId).Delete(&models.AgentTokenApi{}).Error; err != nil {
			return err
		}
		now := dates.NowTimestamp()
		for _, api := range apis {
			if api.Method == "" || api.Path == "" {
				continue
			}
			item := &models.AgentTokenApi{
				TokenId:    tokenId,
				Method:     api.Method,
				Path:       api.Path,
				CreateTime: now,
			}
			if err := repositories.AgentTokenRepository.CreateApi(ctx.Tx, item); err != nil {
				return err
			}
		}
		return nil
	})
}
