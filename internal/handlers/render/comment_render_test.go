package render

import (
	"bbs-go/internal/models"
	"bbs-go/internal/models/constants"
	"testing"
)

func TestBuildCommentsWithFloor(t *testing.T) {
	comments := []models.Comment{
		{Model: models.Model{Id: 101}, EntityType: "topic", EntityId: 1, Content: "第一条", Status: constants.StatusOk},
		{Model: models.Model{Id: 102}, EntityType: "topic", EntityId: 1, Content: "第二条", Status: constants.StatusOk},
	}

	// 1. 测试第 1 页（offset = 0）：楼层应为 #1, #2
	resPage1 := BuildCommentsWithFloor(comments, nil, false, false, 0)
	if len(resPage1) != 2 {
		t.Fatalf("expected 2 comments, got %d", len(resPage1))
	}
	if resPage1[0].Floor != 1 || resPage1[1].Floor != 2 {
		t.Fatalf("expected floors 1 and 2, got %d and %d", resPage1[0].Floor, resPage1[1].Floor)
	}

	// 2. 测试第 2 页（pageSize = 10, offset = 10）：楼层应为 #11, #12
	resPage2 := BuildCommentsWithFloor(comments, nil, false, false, 10)
	if resPage2[0].Floor != 11 || resPage2[1].Floor != 12 {
		t.Fatalf("expected floors 11 and 12, got %d and %d", resPage2[0].Floor, resPage2[1].Floor)
	}

	// 3. 测试游标模式（offset = -1）：Floor 应当为 0（并在 JSON 中忽略）
	resCursor := BuildComments(comments, nil, false, false)
	if resCursor[0].Floor != 0 || resCursor[1].Floor != 0 {
		t.Fatalf("expected floor 0 in cursor mode, got %d and %d", resCursor[0].Floor, resCursor[1].Floor)
	}
}
