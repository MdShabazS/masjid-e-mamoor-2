'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getBrowserClient } from '../../lib/supabase.js';

const editors = new Set(['president', 'vice_president', 'secretary', 'data_entry']);
export default function ContentPage() {
  const [session, setSession] = useState('checking'),
    [role, setRole] = useState(null);
  const [posts, setPosts] = useState([]),
    [title, setTitle] = useState(''),
    [body, setBody] = useState('');
  const [audience, setAudience] = useState('public'),
    [selected, setSelected] = useState('');
  const [publishAt, setPublishAt] = useState(''),
    [expireAt, setExpireAt] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const operations = useRef(new Map());
  async function rpc(name, args = {}) {
    const { data, error: failure } = await getBrowserClient().rpc(name, args);
    if (failure) throw new Error(failure.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const next = await rpc('current_app_role');
    setRole(next);
    if (editors.has(next))
      setPosts((await rpc('list_managed_community_posts', { p_limit: 50 })) ?? []);
  }
  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getUser()
      .then(async ({ data, error: failure }) => {
        if (!active) return;
        if (failure || !data?.user) {
          setSession('signed-out');
          return;
        }
        try {
          await load();
          if (active) setSession('ready');
        } catch (cause) {
          if (active) {
            setError(cause.message);
            setSession('ready');
          }
        }
      })
      .catch(() => {
        if (active) setSession('signed-out');
      });
    return () => {
      active = false;
    };
  }, []);
  async function command(name, args, message) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = `${name}:${JSON.stringify(args)}`,
      id = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, id);
    try {
      await rpc(name, { ...args, p_operation_id: id });
      operations.current.delete(key);
      setNotice(message);
      try {
        await load();
      } catch {
        setError('Saved. Reload to see the latest revision.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    const post = posts.find((item) => item.post_id === selected);
    const args = post
      ? {
          p_id: post.post_id,
          p_title: title.trim(),
          p_body: body.trim(),
          p_audience: audience,
          p_expected_revision: post.revision,
        }
      : { p_title: title.trim(), p_body: body.trim(), p_audience: audience };
    if (
      await command(
        post ? 'revise_community_post' : 'create_community_post',
        args,
        post
          ? 'Revision saved. Published member edits enqueue a new inbox revision on the next tick.'
          : 'Draft saved. It is not visible until published.',
      )
    ) {
      setSelected('');
      setTitle('');
      setBody('');
      setAudience('public');
    }
  }
  async function publish(post) {
    const start = new Date(publishAt),
      end = expireAt ? new Date(expireAt) : null;
    if (!Number.isFinite(start.getTime()) || (end && !Number.isFinite(end.getTime()))) {
      setError('Enter a valid publication date and optional expiry.');
      return;
    }
    await command(
      'publish_community_post',
      {
        p_id: post.post_id,
        p_publish_at: start.toISOString(),
        p_expire_at: end?.toISOString() ?? null,
        p_expected_revision: post.revision,
      },
      'Publication scheduled. It becomes visible at its publication time.',
    );
  }
  return (
    <main className="management">
      <Link href="/announcements">← Announcements</Link>
      <h1>Community content</h1>
      <p className="muted">
        Drafts and member posts stay private. Public posts appear only after publication time.
      </p>
      {session === 'checking' && <p>Checking account…</p>}
      {session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {session === 'ready' && !editors.has(role) && (
        <p>Your role cannot manage community content.</p>
      )}
      {session === 'ready' && editors.has(role) && (
        <>
          <form className="panel" onSubmit={save}>
            <h2>{selected ? 'Revise content' : 'Create a draft'}</h2>
            <label className="field">
              Title
              <input
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field">
              Text
              <textarea
                required
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <label className="field">
              Audience
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={posts.find((item) => item.post_id === selected)?.status === 'published'}
              >
                <option value="public">Public</option>
                <option value="members">Signed-in members</option>
              </select>
            </label>
            <button className="primary" disabled={busy}>
              Save
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  setSelected('');
                  setTitle('');
                  setBody('');
                  setAudience('public');
                }}
              >
                Clear selection
              </button>
            )}
          </form>
          <section className="panel">
            <h2>Drafts and published posts</h2>
            {posts.length === 0 ? (
              <p>No content yet.</p>
            ) : (
              posts.map((post) => (
                <article className="panel" key={post.post_id}>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                  <p className="muted">
                    {post.audience} · {post.status} · revision {post.revision}
                    {post.publish_at
                      ? ` · ${new Date(post.publish_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
                      : ''}
                  </p>
                  {post.status !== 'archived' && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setSelected(post.post_id);
                        setTitle(post.title);
                        setBody(post.body);
                        setAudience(post.audience);
                      }}
                    >
                      Edit text
                    </button>
                  )}
                  {post.status === 'draft' && (
                    <>
                      <label className="field">
                        Publish time (your device time)
                        <input
                          type="datetime-local"
                          value={publishAt}
                          onChange={(e) => setPublishAt(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Expiry (optional)
                        <input
                          type="datetime-local"
                          value={expireAt}
                          onChange={(e) => setExpireAt(e.target.value)}
                        />
                      </label>
                      <button disabled={busy || !publishAt} onClick={() => publish(post)}>
                        Publish or schedule
                      </button>
                    </>
                  )}
                  {post.status !== 'archived' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        command(
                          'archive_community_post',
                          {
                            p_id: post.post_id,
                            p_expected_revision: post.revision,
                          },
                          'Content archived and removed from public/member views.',
                        )
                      }
                    >
                      Archive
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
