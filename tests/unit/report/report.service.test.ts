import { expect, jest, test } from "@jest/globals";
import type { Selectable } from "kysely";

import type { ReportComments } from "@/db/types.js";
import { toReportCommentResponse } from "@/module/report/report.mapper.js";
import type { ReportPgRepository } from "@/module/report/report.pg-repository.js";
import type { ReportPublisher } from "@/module/report/report.publisher.js";
import { ReportService } from "@/module/report/report.service.js";

const reportId = "00000000-0000-0000-0000-000000000001";
const commentId = "00000000-0000-0000-0000-000000000002";
const authorActorId = "00000000-0000-0000-0000-000000000003";
const otherActorId = "00000000-0000-0000-0000-000000000004";

function comment(input: Partial<Selectable<ReportComments>> = {}): Selectable<ReportComments> {
  return {
    id: commentId,
    report_id: reportId,
    author_actor_id: authorActorId,
    author_argus_user_id: null,
    parent_comment_id: null,
    comment_text: "Original.",
    is_sticky: false,
    created_at_ms: "1000",
    edited_at_ms: null,
    deleted_at_ms: null,
    deleted_by_actor_id: null,
    deleted_by_argus_user_id: null,
    ...input,
  };
}

function serviceWithRepo(repo: Partial<ReportPgRepository>) {
  return new ReportService(
    repo as ReportPgRepository,
    { publish: jest.fn<(...args: unknown[]) => Promise<unknown>>() } as unknown as ReportPublisher,
  );
}

test("updateComment rejects non-admin edits to another actor's comment", async () => {
  const updateComment = jest.fn<ReportPgRepository["updateComment"]>();
  const service = serviceWithRepo({
    findCommentById: jest.fn<ReportPgRepository["findCommentById"]>().mockResolvedValue(comment()),
    updateComment,
  });

  await expect(
    service.updateComment(reportId, commentId, { commentText: "Updated." }, otherActorId, false),
  ).rejects.toMatchObject({
    code: "REPORT_COMMENT_FORBIDDEN",
  });
  expect(updateComment).not.toHaveBeenCalled();
});

test("updateComment allows authors to edit their own comment and stamps editedAtMs", async () => {
  const updated = comment({ comment_text: "Updated.", edited_at_ms: "2000" });
  const updateComment = jest.fn<ReportPgRepository["updateComment"]>().mockResolvedValue(updated);
  const service = serviceWithRepo({
    findCommentById: jest.fn<ReportPgRepository["findCommentById"]>().mockResolvedValue(comment()),
    updateComment,
  });

  const result = await service.updateComment(
    reportId,
    commentId,
    { commentText: "Updated." },
    authorActorId,
    false,
  );

  expect(updateComment).toHaveBeenCalledWith({
    reportId,
    commentId,
    commentText: "Updated.",
  });
  expect(result).toMatchObject({
    commentText: "Updated.",
    editedAtMs: "2000",
  });
});

test("updateComment rejects edits to deleted comments", async () => {
  const updateComment = jest.fn<ReportPgRepository["updateComment"]>();
  const service = serviceWithRepo({
    findCommentById: jest
      .fn<ReportPgRepository["findCommentById"]>()
      .mockResolvedValue(comment({ deleted_at_ms: "2000", deleted_by_actor_id: authorActorId })),
    updateComment,
  });

  await expect(
    service.updateComment(reportId, commentId, { commentText: "Updated." }, authorActorId, false),
  ).rejects.toMatchObject({
    code: "REPORT_COMMENT_NOT_FOUND",
  });
  expect(updateComment).not.toHaveBeenCalled();
});

test("deleteComment passes actor id so threaded comments can be tombstoned", async () => {
  const deleteComment = jest
    .fn<ReportPgRepository["deleteComment"]>()
    .mockResolvedValue("tombstoned");
  const service = serviceWithRepo({
    findCommentById: jest.fn<ReportPgRepository["findCommentById"]>().mockResolvedValue(comment()),
    deleteComment,
  });

  await service.deleteComment(reportId, commentId, otherActorId, null, true);

  expect(deleteComment).toHaveBeenCalledWith(reportId, commentId, otherActorId, null);
});

test("toReportCommentResponse hides tombstoned comment text", () => {
  const result = toReportCommentResponse(
    comment({
      comment_text: "[deleted]",
      is_sticky: true,
      deleted_at_ms: "2000",
      deleted_by_actor_id: otherActorId,
    }),
  );

  expect(result).toMatchObject({
    commentText: null,
    isSticky: false,
    isDeleted: true,
    deletedAtMs: "2000",
    deletedByActorId: otherActorId,
  });
});
