import { supabase } from "../lib/supabase";

import {
  cancelCommitteeMeeting,
  committeeMeetingDetailQueryKey,
  committeeMeetingInvalidationKeys,
  committeeMeetingListQueryKey,
  committeeMeetingParticipantOptionsQueryKey,
  createCommitteeMeeting,
  getCommitteeMeeting,
  listCommitteeMeetingParticipantOptions,
  listCommitteeMeetings,
  recordCommitteeMeetingAttendance,
  updateCommitteeMeeting,
} from "./meetings";

jest.mock("../lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const rpc = supabase.rpc as jest.Mock;

const meetingRow = {
  id: "meeting-1",
  title: "Committee meeting",
  meeting_type: "general",
  details: null,
  location: "Hall",
  scheduled_start:
    "2026-10-20T13:00:00.000Z",
  scheduled_end:
    "2026-10-20T14:00:00.000Z",
  status: "scheduled",
  created_by_application_user_id:
    "admin-1",
  cancelled_by_application_user_id:
    null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at:
    "2026-10-08T14:00:00.000Z",
  updated_at:
    "2026-10-08T14:00:00.000Z",
  participant_ids: [
    "committee-1",
  ],
};

const draft = {
  title: " Committee meeting ",
  meetingType: " general ",
  details: " Agenda ",
  location: " Hall ",
  scheduledStart:
    "2026-10-20T13:00:00.000Z",
  scheduledEnd:
    "2026-10-20T14:00:00.000Z",
  participantIds: [
    "committee-1",
  ],
};

beforeEach(() => {
  rpc.mockReset();
});

describe(
  "committee meetings query contract",
  () => {
    it(
      "uses stable scoped query keys",
      () => {
        expect(
          committeeMeetingListQueryKey(
            "actor-1",
          ),
        ).toEqual([
          "committee-meetings",
          "actor-1",
        ]);

        expect(
          committeeMeetingDetailQueryKey(
            "meeting-1",
          ),
        ).toEqual([
          "committee-meetings",
          "detail",
          "meeting-1",
        ]);

        expect(
          committeeMeetingParticipantOptionsQueryKey(),
        ).toEqual([
          "committee-meetings",
          "participant-options",
        ]);

        expect(
          committeeMeetingInvalidationKeys(
            "actor-1",
            "meeting-1",
          ),
        ).toEqual([
          [
            "committee-meetings",
            "actor-1",
          ],
          [
            "committee-meetings",
            "detail",
            "meeting-1",
          ],
        ]);
      },
    );

    it(
      "maps the meeting list RPC",
      async () => {
        rpc.mockResolvedValueOnce({
          data: [meetingRow],
          error: null,
        });

        const meetings =
          await listCommitteeMeetings();

        expect(rpc).toHaveBeenCalledWith(
          "list_committee_meetings",
          {
            p_limit: 100,
            p_offset: 0,
          },
        );

        expect(meetings).toEqual([
          expect.objectContaining({
            id: "meeting-1",
            meetingType: "general",
            status: "scheduled",
            participantIds: [
              "committee-1",
            ],
          }),
        ]);
      },
    );

    it(
      "maps meeting detail participants, attendance, and activity",
      async () => {
        rpc.mockResolvedValueOnce({
          data: {
            meeting: {
              ...meetingRow,
              participant_ids:
                undefined,
            },
            participants: [
              {
                application_user_id:
                  "committee-1",
                display_name:
                  "Committee One",
                role_label:
                  "Committee Member",
                assigned_at:
                  "2026-10-08T14:00:00.000Z",
              },
            ],
            attendance: [
              {
                id: "attendance-1",
                meeting_id:
                  "meeting-1",
                application_user_id:
                  "committee-1",
                attendance_status:
                  "present",
                recorded_by_application_user_id:
                  "secretary-1",
                recorded_at:
                  "2026-10-20T13:30:00.000Z",
                operation_id:
                  "attendance-op",
              },
            ],
            activity: [
              {
                id: "activity-1",
                meeting_id:
                  "meeting-1",
                actor_application_user_id:
                  "admin-1",
                activity_type:
                  "meeting_created",
                details: {
                  notification_event:
                    "meeting_created",
                },
                operation_id:
                  "create-op",
                created_at:
                  "2026-10-08T14:00:00.000Z",
              },
            ],
          },
          error: null,
        });

        const meeting =
          await getCommitteeMeeting(
            "meeting-1",
          );

        expect(meeting.participantIds)
          .toEqual(["committee-1"]);

        expect(meeting.participants[0])
          .toMatchObject({
            applicationUserId:
              "committee-1",
            displayName:
              "Committee One",
          });

        expect(meeting.attendance[0])
          .toMatchObject({
            attendanceStatus:
              "present",
            operationId:
              "attendance-op",
          });

        expect(meeting.activity[0])
          .toMatchObject({
            activityType:
              "meeting_created",
            operationId:
              "create-op",
          });
      },
    );

    it(
      "maps participant option discovery",
      async () => {
        rpc.mockResolvedValueOnce({
          data: [
            {
              application_user_id:
                "committee-1",
              display_name:
                "Committee One",
              role_label:
                "Committee Member",
            },
          ],
          error: null,
        });

        await expect(
          listCommitteeMeetingParticipantOptions(),
        ).resolves.toEqual([
          {
            applicationUserId:
              "committee-1",
            displayName:
              "Committee One",
            roleLabel:
              "Committee Member",
          },
        ]);
      },
    );
  },
);

describe(
  "committee meetings trusted mutations",
  () => {
    it(
      "calls create RPC with supplied stable operation ID",
      async () => {
        rpc.mockResolvedValueOnce({
          data: meetingRow,
          error: null,
        });

        await createCommitteeMeeting(
          draft,
          "create-op",
        );

        expect(rpc).toHaveBeenCalledWith(
          "create_committee_meeting",
          {
            p_title:
              "Committee meeting",
            p_meeting_type:
              "general",
            p_details: "Agenda",
            p_location: "Hall",
            p_scheduled_start:
              draft.scheduledStart,
            p_scheduled_end:
              draft.scheduledEnd,
            p_participant_ids: [
              "committee-1",
            ],
            p_operation_id:
              "create-op",
          },
        );
      },
    );

    it(
      "normalizes optional create fields to null",
      async () => {
        rpc.mockResolvedValueOnce({
          data: meetingRow,
          error: null,
        });

        await createCommitteeMeeting(
          {
            ...draft,
            details: " ",
            location: "",
            scheduledEnd: " ",
          },
          "create-null-op",
        );

        expect(rpc).toHaveBeenCalledWith(
          "create_committee_meeting",
          expect.objectContaining({
            p_details: null,
            p_location: null,
            p_scheduled_end: null,
          }),
        );
      },
    );

    it(
      "calls update and cancel trusted RPCs",
      async () => {
        rpc
          .mockResolvedValueOnce({
            data: meetingRow,
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              ...meetingRow,
              status: "cancelled",
              cancellation_reason:
                "Conflict",
            },
            error: null,
          });

        await updateCommitteeMeeting(
          "meeting-1",
          draft,
          "update-op",
        );

        await cancelCommitteeMeeting(
          "meeting-1",
          " Conflict ",
          "cancel-op",
        );

        expect(
          rpc.mock.calls.map(
            ([name]) => name,
          ),
        ).toEqual([
          "update_committee_meeting",
          "cancel_committee_meeting",
        ]);

        expect(
          rpc.mock.calls[0][1],
        ).toEqual(
          expect.objectContaining({
            p_meeting_id:
              "meeting-1",
            p_operation_id:
              "update-op",
          }),
        );

        expect(
          rpc.mock.calls[1][1],
        ).toEqual({
          p_meeting_id:
            "meeting-1",
          p_reason: "Conflict",
          p_operation_id:
            "cancel-op",
        });
      },
    );

    it(
      "records attendance through the trusted RPC",
      async () => {
        rpc.mockResolvedValueOnce({
          data: {
            id: "attendance-1",
            meeting_id:
              "meeting-1",
            application_user_id:
              "committee-1",
            attendance_status:
              "present",
            recorded_by_application_user_id:
              "secretary-1",
            recorded_at:
              "2026-10-20T13:30:00.000Z",
            operation_id:
              "attendance-op",
          },
          error: null,
        });

        const attendance =
          await recordCommitteeMeetingAttendance(
            "meeting-1",
            "committee-1",
            "present",
            "attendance-op",
          );

        expect(rpc).toHaveBeenCalledWith(
          "record_committee_meeting_attendance",
          {
            p_meeting_id:
              "meeting-1",
            p_application_user_id:
              "committee-1",
            p_attendance_status:
              "present",
            p_operation_id:
              "attendance-op",
          },
        );

        expect(attendance)
          .toMatchObject({
            attendanceStatus:
              "present",
            operationId:
              "attendance-op",
          });
      },
    );

    it(
      "surfaces backend RPC failures unchanged",
      async () => {
        rpc.mockResolvedValueOnce({
          data: null,
          error: {
            message:
              "missing_permission",
          },
        });

        await expect(
          cancelCommitteeMeeting(
            "meeting-1",
            "Reason",
            "cancel-op",
          ),
        ).rejects.toThrow(
          "missing_permission",
        );
      },
    );
  },
);
