package repositories

import (
	"bbs-go/internal/models"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var TaskEventDefRepository = newTaskEventDefRepository()

func newTaskEventDefRepository() *taskEventDefRepository {
	return &taskEventDefRepository{}
}

type taskEventDefRepository struct {
}

func (r *taskEventDefRepository) Get(db *gorm.DB, id int64) *models.TaskEventDef {
	ret := &models.TaskEventDef{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *taskEventDefRepository) Take(db *gorm.DB, where ...interface{}) *models.TaskEventDef {
	ret := &models.TaskEventDef{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *taskEventDefRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.TaskEventDef) {
	cnd.Find(db, &list)
	return
}

func (r *taskEventDefRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.TaskEventDef {
	ret := &models.TaskEventDef{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *taskEventDefRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.TaskEventDef, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *taskEventDefRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.TaskEventDef, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.TaskEventDef{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *taskEventDefRepository) FindBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (list []models.TaskEventDef) {
	db.Raw(sqlStr, paramArr...).Scan(&list)
	return
}

func (r *taskEventDefRepository) CountBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (count int64) {
	db.Raw(sqlStr, paramArr...).Count(&count)
	return
}

func (r *taskEventDefRepository) Count(db *gorm.DB, cnd *sqls.Cnd) int64 {
	return cnd.Count(db, &models.TaskEventDef{})
}

func (r *taskEventDefRepository) Create(db *gorm.DB, t *models.TaskEventDef) (err error) {
	err = db.Create(t).Error
	return
}

func (r *taskEventDefRepository) Update(db *gorm.DB, t *models.TaskEventDef) (err error) {
	err = db.Save(t).Error
	return
}

func (r *taskEventDefRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.TaskEventDef{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *taskEventDefRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.TaskEventDef{}).Where("id = ?", id).UpdateColumn(name, value).Error
	return
}

func (r *taskEventDefRepository) Delete(db *gorm.DB, id int64) {
	db.Delete(&models.TaskEventDef{}, "id = ?", id)
}
