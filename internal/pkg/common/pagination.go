package common

import (
	"bbs-go/internal/models/resp"
	"math"
)

const DefaultPageSize = 10

// BuildPagination 计算标准的分页元数据（对齐 NodeSeek 固定步长与无障碍语义）
func BuildPagination(page, pageSize int, totalCount int64) resp.Pagination {
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}

	totalPages := int(math.Ceil(float64(totalCount) / float64(pageSize)))
	if totalPages < 1 {
		totalPages = 1
	}

	// 边界修正
	if page < 1 {
		page = 1
	} else if page > totalPages {
		page = totalPages
	}

	// 构造页码列表：页数较少时全部展示，页数较多时提供以当前页为中心的滑动窗口
	var pageList []int
	if totalPages <= 7 {
		pageList = make([]int, 0, totalPages)
		for i := 1; i <= totalPages; i++ {
			pageList = append(pageList, i)
		}
	} else {
		start := page - 3
		end := page + 3
		if start < 1 {
			end += 1 - start
			start = 1
		}
		if end > totalPages {
			start -= end - totalPages
			end = totalPages
		}
		if start < 1 {
			start = 1
		}
		pageList = make([]int, 0, end-start+1)
		for i := start; i <= end; i++ {
			pageList = append(pageList, i)
		}
	}

	return resp.Pagination{
		CurrentPage: page,
		PageSize:    pageSize,
		TotalCount:  totalCount,
		TotalPages:  totalPages,
		HasPrev:     page > 1,
		HasNext:     page < totalPages,
		PrevPage:    page - 1,
		NextPage:    page + 1,
		PageList:    pageList,
	}
}
