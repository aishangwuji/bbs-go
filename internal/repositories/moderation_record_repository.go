package repositories

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var ModerationRecordRepository = newModerationRecordRepository()

func newModerationRecordRepository() *moderationRecordRepository {
	return &moderationRecordRepository{}
}

type moderationRecordRepository struct {
}

func (r *moderationRecordRepository) Get(db *gorm.DB, id int64) *models.ModerationRecord {
	ret := &models.ModerationRecord{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *moderationRecordRepository) Take(db *gorm.DB, where ...interface{}) *models.ModerationRecord {
	ret := &models.ModerationRecord{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *moderationRecordRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.ModerationRecord) {
	cnd.Find(db, &list)
	return
}

func (r *moderationRecordRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.ModerationRecord {
	ret := &models.ModerationRecord{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *moderationRecordRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.ModerationRecord, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *moderationRecordRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.ModerationRecord, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.ModerationRecord{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *moderationRecordRepository) Count(db *gorm.DB, cnd *sqls.Cnd) int64 {
	return cnd.Count(db, &models.ModerationRecord{})
}

func (r *moderationRecordRepository) Create(db *gorm.DB, t *models.ModerationRecord) error {
	return db.Create(t).Error
}

func (r *moderationRecordRepository) Update(db *gorm.DB, t *models.ModerationRecord) error {
	return db.Save(t).Error
}

func (r *moderationRecordRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) error {
	return db.Model(&models.ModerationRecord{}).Where("id = ?", id).Updates(columns).Error
}

func (r *moderationRecordRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) error {
	return db.Model(&models.ModerationRecord{}).Where("id = ?", id).Update(name, value).Error
}

func (r *moderationRecordRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.ModerationRecord{}, "id = ?", id).Error
}
