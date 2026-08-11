package repositories

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var AgentTokenRepository = newAgentTokenRepository()

func newAgentTokenRepository() *agentTokenRepository {
	return &agentTokenRepository{}
}

type agentTokenRepository struct {
}

func (r *agentTokenRepository) Get(db *gorm.DB, id int64) *models.AgentToken {
	ret := &models.AgentToken{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *agentTokenRepository) Take(db *gorm.DB, where ...interface{}) *models.AgentToken {
	ret := &models.AgentToken{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *agentTokenRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.AgentToken) {
	cnd.Find(db, &list)
	return
}

func (r *agentTokenRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.AgentToken {
	ret := &models.AgentToken{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *agentTokenRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.AgentToken, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *agentTokenRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.AgentToken, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.AgentToken{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *agentTokenRepository) Create(db *gorm.DB, t *models.AgentToken) (err error) {
	err = db.Create(t).Error
	return
}

func (r *agentTokenRepository) Update(db *gorm.DB, t *models.AgentToken) (err error) {
	err = db.Save(t).Error
	return
}

func (r *agentTokenRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.AgentToken{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *agentTokenRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.AgentToken{}).Where("id = ?", id).UpdateColumn(name, value).Error
	return
}

func (r *agentTokenRepository) Delete(db *gorm.DB, id int64) {
	db.Delete(&models.AgentToken{}, "id = ?", id)
}

func (r *agentTokenRepository) FindApisByTokenId(db *gorm.DB, tokenId int64) (list []models.AgentTokenApi) {
	db.Where("token_id = ?", tokenId).Order("id asc").Find(&list)
	return
}

func (r *agentTokenRepository) HasApi(db *gorm.DB, tokenId int64, method, path string) bool {
	var count int64
	db.Model(&models.AgentTokenApi{}).Where("token_id = ? and method = ? and path = ?", tokenId, method, path).Count(&count)
	return count > 0
}

func (r *agentTokenRepository) DeleteApisByTokenId(db *gorm.DB, tokenId int64) {
	db.Where("token_id = ?", tokenId).Delete(&models.AgentTokenApi{})
}

func (r *agentTokenRepository) CreateApi(db *gorm.DB, t *models.AgentTokenApi) (err error) {
	err = db.Create(t).Error
	return
}
