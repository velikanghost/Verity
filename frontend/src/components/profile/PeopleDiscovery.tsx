'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import FollowButton from '@/components/profile/FollowButton'
import { useFeed } from '@/hooks/useFeed'
import { displayHandle, displayName, type Profile } from '@/lib/verity'

export default function PeopleDiscovery() {
  const { items } = useFeed()
  const people = Array.from(
    new Map(items.map((item) => [item.author.id, item.author])).values(),
  ).slice(0, 4)

  return (
    <section className="verity-card overflow-hidden">
      <div className="border-b border-dashed border-stone-surface p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
          <Users className="h-4 w-4 text-sky-blue" />
          People to follow
        </h2>
      </div>

      {people.length > 0 ? (
        <div className="grid gap-0 sm:grid-cols-2">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm tracking-[-0.18px] text-ash sm:p-5">
          Creators will appear here once the feed has activity.
        </div>
      )}
    </section>
  )
}

function PersonCard({ person }: { person: Profile }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-stone-surface p-4 transition-colors hover:bg-parchment-card sm:p-5 sm:odd:border-r">
      <Link
        className="flex min-w-0 items-center gap-3"
        href={`/profile/${encodeURIComponent(person.id)}`}
      >
        <div className="verity-blob h-11 w-11 shrink-0 bg-sky-blue">
          <span className="verity-blob-smile" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.18px] text-charcoal-primary hover:underline">
            {displayName(person)}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-ash">
            {displayHandle(person)}
          </p>
        </div>
      </Link>
      <FollowButton compact profile={person} />
    </div>
  )
}
