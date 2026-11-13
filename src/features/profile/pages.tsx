import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { PublicUser } from '@shared/api.ts';
import { rankForLevel } from '@shared/game/levels.ts';
import { TROPHY_BY_ID } from '@shared/game/trophies.ts';
import { Page } from '@/app/Layout.tsx';
import { toast } from '@/components/glass/feedback.tsx';
import { Avatar, Flame, LevelBadge, TierPips, TrophyIcon } from '@/components/game.tsx';
import { Button, Card, Empty, Loading, SectionTitle, Stat } from '@/components/ui.tsx';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { errorMessage, useT } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { fmtDateLong, fmtNumber } from '@/lib/format.ts';
import { keys, queryClient, useFollowing, useMe, useProfile } from '@/lib/queries.ts';
import { WorkoutRow } from '../workout/pages.tsx';

/** `/profile` shows yourself; `/u/:username` shows anyone. */
export function ProfilePage() {
  const { username } = useParams();
  const me = useMe().data;
  const name = username ?? me?.user.username;
  return <ProfileView username={name} own={!username} />;
}

function ProfileView({ username, own }: { username: string | undefined; own: boolean }) {
  const { t, tn, loc, lang } = useT();
  const { data: p, isLoading, isError } = useProfile(username);
  const [busy, setBusy] = useState(false);

  const follow = async (on: boolean) => {
    if (!p) return;
    setBusy(true);
    try {
      const res = await api<{ unlocked?: Array<{ id: string }> }>(`/users/${p.username}/follow`, { method: on ? 'PUT' : 'DELETE' });
      for (const u of res.unlocked ?? []) {
        const def = TROPHY_BY_ID.get(u.id);
        if (def) toast(t('toast.trophy', { name: loc(def.name) }), 'cup');
      }
      void queryClient.invalidateQueries({ queryKey: keys.profile(p.username) });
      void queryClient.invalidateQueries({ queryKey: keys.following });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: keys.game });
    } catch (e) {
      toast(errorMessage(t, e), 'close');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={own ? t('profile.title') : `@${username ?? ''}`}
      back={own ? undefined : true}
      actions={
        own ? (
          <>
            <Link to="/friends" className="inline-flex h-11 w-11 items-center justify-center" aria-label={t('profile.friends')} title={t('profile.friends')}>
              <PeopleIcon />
            </Link>
            <Link to="/settings" className="inline-flex h-11 w-11 items-center justify-center" aria-label={t('profile.settings')} title={t('profile.settings')}>
              <GearIcon />
            </Link>
          </>
        ) : undefined
      }
    >
      {isLoading && <Loading label={t('common.loading')} />}
      {isError && <Empty icon="search">{t('profile.notFound')}</Empty>}
      {p && (
        <>
          <Card dialog className="flex flex-col items-center gap-2 text-center">
            <Avatar id={p.avatar} size={88} label={p.username} />
            <h2 className="text-sm" data-testid="profile-name">
              {p.displayName || p.username}
            </h2>
            <p className="text-sm text-ink-soft">@{p.username}</p>
            <div className="flex items-center gap-2">
              <LevelBadge level={p.level} size={36} />
              <span className="font-pixel text-[10px]">{loc(rankForLevel(p.level).name)}</span>
            </div>
            <p className="text-xs text-ink-soft">{t('profile.memberSince', { date: fmtDateLong(p.createdAt, lang) })}</p>
            {!p.isMe && (
              <Button variant={p.isFollowing ? 'default' : 'primary'} disabled={busy} onClick={() => void follow(!p.isFollowing)} aria-pressed={p.isFollowing}>
                {t(p.isFollowing ? 'profile.unfollow' : 'profile.follow')}
              </Button>
            )}
          </Card>

          <div className="mt-4 grid grid-cols-3 gap-1">
            <Stat label={t('profile.totalXp')} value={fmtNumber(p.totalXp, lang, 0)} />
            <Stat
              label={t('profile.streak')}
              value={
                <span className="inline-flex items-center gap-1">
                  <Flame lit={p.streak > 0} size={14} animate={false} />
                  {p.streak}
                </span>
              }
            />
            <Stat label={t('profile.workouts')} value={p.workouts} />
            <Stat label={t('profile.followers')} value={p.followers} />
            <Stat label={t('profile.following')} value={p.following} />
            <Stat label={t('stats.bestStreak')} value={tn('unit.week', p.bestStreak)} />
          </div>

          <SectionTitle action={own ? <Link to="/progress?tab=trophies" className="text-sm font-semibold underline">{t('home.seeAll')}</Link> : undefined}>{t('profile.trophies')}</SectionTitle>
          {p.trophies.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">{t('profile.noTrophies')}</p>
            </Card>
          ) : (
            <Card>
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {p.trophies.map((tr) => {
                  const def = TROPHY_BY_ID.get(tr.id);
                  if (!def) return null;
                  return (
                    <li key={tr.id} className="flex flex-col items-center gap-1 text-center" title={loc(def.name)}>
                      <TrophyIcon def={def} tier={tr.tier} size={36} />
                      <TierPips def={def} tier={tr.tier} />
                      <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{loc(def.name)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <SectionTitle>{t('profile.recent')}</SectionTitle>
          {p.recentWorkouts === null ? (
            <Card>
              <p className="text-sm text-ink-soft">🔒 {t('profile.private')}</p>
            </Card>
          ) : p.recentWorkouts.length === 0 ? (
            <Empty icon="clock">{t('history.empty')}</Empty>
          ) : (
            <ul className="space-y-3">
              {p.recentWorkouts.map((w) => (
                <WorkoutRow key={w.id} w={w} to={p.isMe ? `/history/${w.id}` : undefined} />
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}

const PeopleIcon = () => <PixelSprite sprite="people" size={18} palette={{ k: 'currentColor', x: 'transparent' }} />;
const GearIcon = () => <PixelSprite sprite="gear" size={18} />;

function UserRow({ u }: { u: PublicUser }) {
  const { t } = useT();
  return (
    <li>
      <Link to={`/u/${u.username}`} className="px px-thin flex items-center gap-3 p-2">
        <Avatar id={u.avatar} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{u.displayName || u.username}</span>
          <span className="block truncate text-xs text-ink-soft">@{u.username}</span>
        </span>
        <span className="text-xs font-semibold">{t('profile.level', { level: u.level })}</span>
      </Link>
    </li>
  );
}

export function FriendsPage() {
  const { t } = useT();
  const [q, setQ] = useState('');
  const query = q.trim();
  const search = useQuery({
    queryKey: ['user-search', query.toLowerCase()],
    queryFn: async () => (await api<{ users: PublicUser[] }>(`/users/search?q=${encodeURIComponent(query)}`)).users,
    enabled: query.length >= 2,
  });
  const following = useFollowing().data;
  const me = useMe().data;
  return (
    <Page title={t('friends.title')} back="/profile">
      <input type="search" className="px-input" placeholder={t('friends.search')} aria-label={t('friends.search')} autoCapitalize="none" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} />
      {query.length < 2 ? (
        <p className="mt-2 px-1 text-sm text-ink-soft">{t('friends.searchHint')}</p>
      ) : search.isLoading ? (
        <Loading label={t('common.loading')} />
      ) : (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {search.data?.filter((u) => u.username !== me?.user.username).map((u) => <UserRow key={u.username} u={u} />)}
          {search.data?.length === 0 && <p className="px-1 text-sm text-ink-soft">{t('friends.noResults')}</p>}
        </ul>
      )}
      <SectionTitle>{t('friends.following')}</SectionTitle>
      {following?.length === 0 && <p className="px-1 text-sm text-ink-soft">{t('friends.none')}</p>}
      <ul className="space-y-2">{following?.map((u) => <UserRow key={u.username} u={u} />)}</ul>
    </Page>
  );
}
