-- 评论计数核查 SQL 留档（只读，可安全执行）
--
-- 背景：
--   话题页显示的评论数取自冗余字段 t_topic.comment_count（后端 render 直接透传，
--   见 internal/handlers/render/topic_render.go），而楼层列表只查 status=0 的可见评论
--   （见 internal/services/comment_service.go GetCommentsByPage/GetComments）。
--   历史上 Jev 智能风控拦截（下架/转待审）、评论删除未回扣话题计数，导致头部数字虚高。
--   修复后增量由 CommentService.Transition 按“可见性 delta”联动（仅 StatusOk 计入），
--   存量漂移由每日 03:30 对账任务自愈（见 internal/services/comment_count_reconcile_service.go）。
--
-- 状态口径（internal/models/constants/constants.go）：
--   0 = 正常（可见，计入计数） / 1 = 删除 / 2 = 待审核
--
-- 用法：把 <话题ID> / <用户ID> 换成实际值执行；三条均为 SELECT，不写库。

-- ① 漂移面总览：冗余计数与可见数不一致的 TOP20（差值越大越靠前）
SELECT t.id AS topic_id, t.comment_count AS 冗余计数, COUNT(c.id) AS 可见评论数,
       (t.comment_count - COUNT(c.id)) AS 虚高差值
FROM t_topic t LEFT JOIN t_comment c
  ON c.entity_type = 'topic' AND c.entity_id = t.id AND c.status = 0
GROUP BY t.id HAVING t.comment_count <> COUNT(c.id)
ORDER BY (t.comment_count - COUNT(c.id)) DESC LIMIT 20;

-- ② 单话题强查：与话题页头部数字对照（0 的行数应等于 t_topic.comment_count）
SELECT status, COUNT(*) AS 数量 FROM t_comment
WHERE entity_type = 'topic' AND entity_id = <话题ID> GROUP BY status;
SELECT id, comment_count AS 冗余计数 FROM t_topic WHERE id = <话题ID>;

-- ③ 单用户强查：t_user.comment_count 应等于该用户 status=0 的评论数
SELECT status, COUNT(*) AS 数量 FROM t_comment
WHERE user_id = <用户ID> GROUP BY status;
SELECT id, comment_count AS 冗余计数 FROM t_user WHERE id = <用户ID>;
