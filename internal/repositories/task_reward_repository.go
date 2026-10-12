package repositories

import (
	"bbs-go/internal/models"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var TaskRewardRepository = newTaskRewardRepository()

func newTaskRewardRepository() *taskRewardRepository {
	return &taskRewardRepository{}
}

type taskRewardRepository struct {
}

func (r *taskRewardRepository) Get(db *gorm.DB, id int64) *models.TaskReward {
	ret := &models.TaskReward{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *taskRewardRepository) Take(db *gorm.DB, where ...interface{}) *models.TaskReward {
	ret := &models.TaskReward{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *taskRewardRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.TaskReward) {
	cnd.Find(db, &list)
	return
}

func (r *taskRewardRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.TaskReward {
	ret := &models.TaskReward{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

// FindEnabledByTaskId 查询任务下启用的奖励明细（按发放顺序排序）
// Business Rule: 只返回 status=0 的行，删除行不参与发放。
func (r *taskRewardRepository) FindEnabledByTaskId(db *gorm.DB, taskId int64) (list []models.TaskReward) {
	return r.Find(db, sqls.NewCnd().Eq("task_id", taskId).Eq("status", 0).Asc("sort_no").Asc("id"))
}

// FindEnabledByTaskIds 批量查询多个任务下启用的奖励明细（按发放顺序排序）
// 业务考量：在任务列表等高频只读接口中聚合发奖配置，单次 IN 查询代替 N+1 次独立查表
func (r *taskRewardRepository) FindEnabledByTaskIds(db *gorm.DB, taskIds []int64) (list []models.TaskReward) {
	if len(taskIds) == 0 {
		return nil
	}
	return r.Find(db, sqls.NewCnd().In("task_id", taskIds).Eq("status", 0).Asc("sort_no").Asc("id"))
}

func (r *taskRewardRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.TaskReward, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *taskRewardRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.TaskReward, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.TaskReward{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *taskRewardRepository) FindBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (list []models.TaskReward) {
	db.Raw(sqlStr, paramArr...).Scan(&list)
	return
}

func (r *taskRewardRepository) CountBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (count int64) {
	db.Raw(sqlStr, paramArr...).Count(&count)
	return
}

func (r *taskRewardRepository) Count(db *gorm.DB, cnd *sqls.Cnd) int64 {
	return cnd.Count(db, &models.TaskReward{})
}

func (r *taskRewardRepository) Create(db *gorm.DB, t *models.TaskReward) (err error) {
	err = db.Create(t).Error
	return
}

func (r *taskRewardRepository) Update(db *gorm.DB, t *models.TaskReward) (err error) {
	err = db.Save(t).Error
	return
}

func (r *taskRewardRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.TaskReward{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *taskRewardRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.TaskReward{}).Where("id = ?", id).UpdateColumn(name, value).Error
	return
}

func (r *taskRewardRepository) Delete(db *gorm.DB, id int64) {
	db.Delete(&models.TaskReward{}, "id = ?", id)
}
