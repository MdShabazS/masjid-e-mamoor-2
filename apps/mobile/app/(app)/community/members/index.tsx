import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "../../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import { listMembers } from "../../../../src/modules/data";
import type { MemberPageCursor, MobileMember } from "../../../../src/modules/types";
import { mergeMemberPages } from "../../../../src/modules/presentation";
import { colors } from "../../../../src/theme/colors";
import { FormTextInput } from "../../../../src/components/Screen";

function statusLabel(status: MobileMember["status"]) {
  return status === "active" ? "Active" : "Inactive";
}

export default function MembersScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const members = useInfiniteQuery<
    Awaited<ReturnType<typeof listMembers>>,
    Error,
    InfiniteData<Awaited<ReturnType<typeof listMembers>>>,
    readonly ["members", string],
    MemberPageCursor | null
  >({
    queryKey: ["members", search],
    queryFn: ({ pageParam }) => listMembers(search, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: capabilities.data?.canReadMembers === true,
  });

  if (!account || capabilities.isLoading) return <LoadingState />;
  if (!capabilities.data?.canReadMembers) return <AccessState />;

  const visibleMembers = mergeMemberPages(members.data?.pages ?? []);

  async function loadMore() {
    if (!members.hasNextPage || members.isFetchingNextPage) return;
    await members.fetchNextPage();
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <FlatList
          contentContainerStyle={styles.content}
          data={visibleMembers}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={members.isRefetching} onRefresh={() => void queryClient.resetQueries({ queryKey: ["members", search] })} tintColor={colors.deepEmerald} />
          }
          ListEmptyComponent={
            members.isLoading ? (
              <LoadingState />
            ) : members.isError ? (
              <ErrorState onRetry={() => void members.refetch()} />
            ) : (
              <EmptyState />
            )
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.eyebrow}>MEMBERSHIP</Text>
              <Text style={styles.title}>Members</Text>
              <View style={styles.searchRow}>
                <FormTextInput
                  autoCapitalize="none"
                  onChangeText={setSearchInput}
                  onSubmitEditing={() => setSearch(searchInput)}
                  placeholder="Search name or phone"
                  placeholderTextColor="#9EA9A3"
                  style={styles.searchInput}
                  value={searchInput}
                />
                <Pressable onPress={() => setSearch(searchInput)} style={styles.searchButton}>
                  <Text style={styles.searchButtonText}>Search</Text>
                </Pressable>
              </View>
            </View>
          }
          ListFooterComponent={
            members.hasNextPage ? (
              <Pressable disabled={members.isFetchingNextPage} onPress={() => void loadMore()} style={styles.loadMore}>
                <Text style={styles.loadMoreText}>{members.isFetchingNextPage ? "Loading..." : "Load more"}</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/community/members/${item.id}`)} style={styles.memberRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{item.displayName}</Text>
                <Text style={styles.memberPhone}>{item.phone ?? "No phone provided"}</Text>
              </View>
              <Text style={[styles.badge, item.status === "inactive" && styles.inactiveBadge]}>
                {statusLabel(item.status)}
              </Text>
            </Pressable>
          )}
        />
    </SafeAreaView>
  );
}

function LoadingState() {
  return <View style={styles.state}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateText}>Loading members...</Text></View>;
}

function AccessState() {
  return <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}><View style={styles.content}><Text style={styles.eyebrow}>MEMBERSHIP</Text><Text style={styles.title}>Members</Text><Text style={styles.stateText}>This member directory is not available for your account.</Text></View></SafeAreaView>;
}

function EmptyState() {
  return <View style={styles.state}><Text style={styles.stateTitle}>No members found</Text><Text style={styles.stateText}>Try a different name or phone number.</Text></View>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <View style={styles.state}><Text style={styles.stateTitle}>Members could not load</Text><Text style={styles.stateText}>Check your connection and try again.</Text><Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 8, marginVertical: 20 },
  searchInput: { backgroundColor: colors.surface, borderColor: "#D8DED8", borderRadius: 10, borderWidth: 1, color: colors.text, flex: 1, height: 48, paddingHorizontal: 13 },
  searchButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 48, justifyContent: "center", paddingHorizontal: 14 },
  searchButtonText: { color: colors.surface, fontSize: 13, fontWeight: "700" },
  memberRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 13, flexDirection: "row", justifyContent: "space-between", marginBottom: 10, padding: 16 },
  memberCopy: { flex: 1, paddingRight: 10 },
  memberName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  memberPhone: { color: colors.secondary, fontSize: 13, marginTop: 5 },
  badge: { backgroundColor: "#E1F0E6", borderRadius: 20, color: colors.success, fontSize: 12, fontWeight: "700", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
  inactiveBadge: { backgroundColor: "#F4E5E3", color: colors.danger },
  state: { alignItems: "center", justifyContent: "center", minHeight: 180, padding: 24 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  stateText: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retry: { backgroundColor: colors.deepEmerald, borderRadius: 9, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.surface, fontWeight: "700" },
  loadMore: { alignItems: "center", padding: 18 },
  loadMoreText: { color: colors.deepEmerald, fontWeight: "700" },
});
