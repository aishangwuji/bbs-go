package repositories

import (
	"bbs-go/internal/models"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var UserGithubProfileRepository = newUserGithubProfileRepository()

func newUserGithubProfileRepository() *userGithubProfileRepository {
	return &userGithubProfileRepository{}
}

type userGithubProfileRepository struct{}

func (r *userGithubProfileRepository) Get(db *gorm.DB, id int64) *models.UserGithubProfile {
	ret := &models.UserGithubProfile{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *userGithubProfileRepository) GetByUserId(db *gorm.DB, userId int64) *models.UserGithubProfile {
	ret := &models.UserGithubProfile{}
	if err := db.Where("user_id = ?", userId).Take(ret).Error; err != nil {
		return nil
	}
	return ret
}

func (r *userGithubProfileRepository) GetByGithubId(db *gorm.DB, githubId int64) *models.UserGithubProfile {
	ret := &models.UserGithubProfile{}
	if err := db.Where("github_id = ?", githubId).Take(ret).Error; err != nil {
		return nil
	}
	return ret
}

func (r *userGithubProfileRepository) Take(db *gorm.DB, where ...interface{}) *models.UserGithubProfile {
	ret := &models.UserGithubProfile{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *userGithubProfileRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.UserGithubProfile) {
	cnd.Find(db, &list)
	return
}

func (r *userGithubProfileRepository) Create(db *gorm.DB, t *models.UserGithubProfile) error {
	return db.Create(t).Error
}

func (r *userGithubProfileRepository) Update(db *gorm.DB, t *models.UserGithubProfile) error {
	return db.Save(t).Error
}
