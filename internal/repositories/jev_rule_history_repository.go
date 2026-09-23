package repositories

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var JevRuleHistoryRepository = newJevRuleHistoryRepository()

func newJevRuleHistoryRepository() *jevRuleHistoryRepository {
	return &jevRuleHistoryRepository{}
}

type jevRuleHistoryRepository struct {
}

func (r *jevRuleHistoryRepository) Get(db *gorm.DB, id int64) *models.JevRuleHistory {
	ret := &models.JevRuleHistory{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *jevRuleHistoryRepository) Take(db *gorm.DB, where ...interface{}) *models.JevRuleHistory {
	ret := &models.JevRuleHistory{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *jevRuleHistoryRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.JevRuleHistory) {
	cnd.Find(db, &list)
	return
}

func (r *jevRuleHistoryRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.JevRuleHistory, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *jevRuleHistoryRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.JevRuleHistory, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.JevRuleHistory{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *jevRuleHistoryRepository) Create(db *gorm.DB, t *models.JevRuleHistory) error {
	return db.Create(t).Error
}

func (r *jevRuleHistoryRepository) Update(db *gorm.DB, t *models.JevRuleHistory) error {
	return db.Save(t).Error
}

func (r *jevRuleHistoryRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) error {
	return db.Model(&models.JevRuleHistory{}).Where("id = ?", id).Updates(columns).Error
}

// DeactivateAll 将所有历史版本的 is_active 状态标记为 false
func (r *jevRuleHistoryRepository) DeactivateAll(db *gorm.DB) error {
	return db.Model(&models.JevRuleHistory{}).Where("is_active = ?", true).Update("is_active", false).Error
}

// PruneOldVersions 保持历史归档规模，仅保留最新的 keepCount 条记录，多余的修剪删除
func (r *jevRuleHistoryRepository) PruneOldVersions(db *gorm.DB, keepCount int) error {
	if keepCount <= 0 {
		keepCount = 50
	}
	var ids []int64
	// 查询超出保留数量的历史版本 ID 列表
	err := db.Model(&models.JevRuleHistory{}).
		Order("id desc").
		Offset(keepCount).
		Limit(100).
		Pluck("id", &ids).Error
	if err != nil || len(ids) == 0 {
		return err
	}
	return db.Where("id IN ?", ids).Delete(&models.JevRuleHistory{}).Error
}
