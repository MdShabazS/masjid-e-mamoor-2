import {
  hasActiveMemberProfile,
  type MobileAccount,
} from "../auth/types";
import { supabase } from "../lib/supabase";
import {
  deriveDonationCapabilities,
  type ResolvedDonationPermissions,
} from "./donation-presentation";

export interface MobileCapabilities {
  canManageAccounts: boolean;
  canReadMembers: boolean;
  canUpdateMembers: boolean;
  canCreateReferral: boolean;
  canUseReferrals: boolean;
  canManageReferrals: boolean;
  canReadDonations: boolean;
  canSubmitPayment: boolean;
  canUploadProof: boolean;
  canCreateAdditionalDonation: boolean;
  canReviewPayments: boolean;
  canAllocatePayments: boolean;
  canVerifyAndAllocatePayments: boolean;
  canManageObligations: boolean;
  canCreateAnonymousDonation: boolean;
  canCreateJummahCashDonation: boolean;
  canManageDonations: boolean;
  canReadCommitteeTasks: boolean;
  canManageCommitteeTasks: boolean;
  canAssignCommitteeTasks: boolean;
}

async function hasPermission(permission: string) {
  const { data, error } = await supabase.rpc("has_application_permission", {
    requested_permission: permission,
  });
  return !error && data === true;
}

export async function loadCapabilities(
  account: MobileAccount,
): Promise<MobileCapabilities> {
  const [
    memberRead,
    memberUpdate,
    referralCreate,
    obligationsRead,
    paymentsCreate,
    proofUpload,
    additionalCreate,
    paymentsVerify,
    paymentsAllocate,
    obligationsManage,
    anonymousCreate,
    jummahCreate,
    committeeTasksRead,
    committeeTasksManage,
    committeeTasksAssign,
  ] = await Promise.all([
    supabase.rpc("can_use_member_admin_read_operations"),
    hasPermission("membership.members.update"),
    hasPermission("membership.referrals.create"),
    hasPermission("donations.obligations.read"),
    hasPermission("donations.payments.create"),
    hasPermission("donations.payments.proof_upload"),
    hasPermission("donations.additional.create"),
    hasPermission("donations.payments.verify"),
    hasPermission("donations.payments.allocate"),
    hasPermission("donations.obligations.manage"),
    hasPermission("donations.anonymous.create"),
    hasPermission("donations.jummah.create"),
    hasPermission("committee.tasks.read"),
    hasPermission("committee.tasks.manage"),
    hasPermission("committee.tasks.assign"),
  ]);

  const canManageReferrals =
    account.role === "president" || account.role === "system_admin";
  const canCreateReferral = Boolean(account.memberProfile) && referralCreate;
  const resolvedDonationPermissions: ResolvedDonationPermissions = {
    obligationsRead,
    paymentsCreate,
    proofUpload,
    additionalCreate,
    paymentsVerify,
    paymentsAllocate,
    obligationsManage,
    anonymousCreate,
    jummahCreate,
  };
  const donationCapabilities = deriveDonationCapabilities(
    resolvedDonationPermissions,
    hasActiveMemberProfile(account),
  );

  return {
    canManageAccounts:
      account.role === "system_admin" || account.role === "president",
    canReadMembers: !memberRead.error && memberRead.data === true,
    canUpdateMembers: memberUpdate,
    canCreateReferral,
    canUseReferrals: canCreateReferral || canManageReferrals,
    canManageReferrals,
    canReadCommitteeTasks: committeeTasksRead,
    canManageCommitteeTasks: committeeTasksManage,
    canAssignCommitteeTasks: committeeTasksAssign,
    ...donationCapabilities,
  };
}
