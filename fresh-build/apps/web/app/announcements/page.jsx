import Link from 'next/link';
import { getPublicPosts } from '../../lib/public-posts.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Announcements | Masjid E Mamoor 2' };

export default async function AnnouncementsPage() {
  const { posts, unavailable } = await getPublicPosts(50);
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link href="/">← Masjid E Mamoor 2</Link>
      </header>
      <section className="public-section">
        <p className="eyebrow">Community updates</p>
        <h1>Announcements</h1>
        <p>
          <Link href="/content">Authorized editors: manage content →</Link>
        </p>
        {unavailable ? (
          <p role="status">Announcements are temporarily unavailable.</p>
        ) : posts.length === 0 ? (
          <p>No announcements have been published yet.</p>
        ) : (
          <div className="announcement-list">
            {posts.map((post) => (
              <article className="feature-card" key={post.post_id}>
                <time dateTime={post.published_at}>
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(post.published_at))}
                </time>
                <h2>{post.title}</h2>
                <p className="post-body">{post.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
