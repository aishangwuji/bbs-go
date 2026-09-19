package common

import (
	"reflect"
	"testing"
)

func TestBuildPagination(t *testing.T) {
	// 场景 1：总数 0
	p0 := BuildPagination(1, 10, 0)
	if p0.TotalPages != 1 || p0.HasPrev || p0.HasNext || len(p0.PageList) != 1 || p0.PageList[0] != 1 {
		t.Fatalf("unexpected pagination for total=0: %+v", p0)
	}

	// 场景 2：总数 25，共 3 页（类似 NodeSeek 测试样例）
	p1 := BuildPagination(1, 10, 25)
	if p1.TotalPages != 3 || p1.CurrentPage != 1 || p1.HasPrev || !p1.HasNext || p1.NextPage != 2 {
		t.Fatalf("unexpected page 1: %+v", p1)
	}
	if !reflect.DeepEqual(p1.PageList, []int{1, 2, 3}) {
		t.Fatalf("unexpected pageList: %+v", p1.PageList)
	}

	p2 := BuildPagination(2, 10, 25)
	if p2.TotalPages != 3 || p2.CurrentPage != 2 || !p2.HasPrev || !p2.HasNext || p2.PrevPage != 1 || p2.NextPage != 3 {
		t.Fatalf("unexpected page 2: %+v", p2)
	}

	p3 := BuildPagination(3, 10, 25)
	if p3.TotalPages != 3 || p3.CurrentPage != 3 || !p3.HasPrev || p3.HasNext || p3.PrevPage != 2 {
		t.Fatalf("unexpected page 3: %+v", p3)
	}

	// 场景 3：页数很多时的滑动窗口（如 20 页，当前在第 10 页）
	p10 := BuildPagination(10, 10, 200)
	if p10.TotalPages != 20 || p10.CurrentPage != 10 || !p10.HasPrev || !p10.HasNext {
		t.Fatalf("unexpected page 10: %+v", p10)
	}
	expectedList := []int{7, 8, 9, 10, 11, 12, 13}
	if !reflect.DeepEqual(p10.PageList, expectedList) {
		t.Fatalf("expected sliding window %v, got %v", expectedList, p10.PageList)
	}
}
