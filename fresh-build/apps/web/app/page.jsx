import Link from 'next/link';
import { getPublicPosts } from '../lib/public-posts.js';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { posts, unavailable } = await getPublicPosts();
  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="brand-mark">✦</span>
        <span>Masjid E Mamoor 2</span>
        <nav aria-label="Main navigation">
          <Link href="/announcements">Announcements</Link>
          {process.env.PUBLIC_RECEIPT_LOOKUP_APPROVED === 'true' && (
            <Link href="/receipt">Verify a receipt</Link>
          )}
          <Link href="/login">Management sign in</Link>
        </nav>
      </header>
      <section className="hero">
        <p className="eyebrow">Masjid E Mamoor 2</p>
        <h1>A place for prayer, service, and community.</h1>
        <p>Welcome. Find published community notices here as this service is prepared.</p>
        <Link className="primary-link" href="/announcements">
          Read announcements
        </Link>
      </section>
      <section aria-labelledby="latest-title" className="public-section">
        <div className="section-heading">
          <h2 id="latest-title">Latest announcements</h2>
          <Link href="/announcements">View all</Link>
        </div>
        {unavailable ? (
          <p className="muted">Announcements are temporarily unavailable.</p>
        ) : posts.length === 0 ? (
          <p className="muted">No announcements have been published yet.</p>
        ) : (
          <div className="card-grid">
            {posts.map((post) => (
              <article className="feature-card" key={post.post_id}>
                <time dateTime={post.published_at}>
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(post.published_at))}
                </time>
                <h3>{post.title}</h3>
                <p className="post-body">{post.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
