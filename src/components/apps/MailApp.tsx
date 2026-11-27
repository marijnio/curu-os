import { useState } from 'react';
import {
  Flag,
  Inbox,
  MailOpen,
  Paperclip,
  Reply,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import { useOsStore } from '../../store/useOsStore';
import { AttachmentCard } from '../shared/AttachmentCard';

export function MailApp() {
  const emails = useOsStore((s) => s.emails);
  const activeEmailId = useOsStore((s) => s.activeEmailId);
  const contacts = useOsStore((s) => s.contacts);
  const activeChoices = useOsStore((s) => s.activeChoices);

  const selectEmail = useOsStore((s) => s.selectEmail);
  const toggleEmailFlag = useOsStore((s) => s.toggleEmailFlag);
  const selectChoice = useOsStore((s) => s.selectChoice);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'flagged'>('all');

  const getContact = (senderId: string) =>
    contacts.find((c) => c.id === senderId);

  const sortedEmails = [...emails].reverse();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEmails = sortedEmails.filter((email) => {
    if (filterMode === 'unread' && email.read) return false;
    if (filterMode === 'flagged' && !email.flagged) return false;
    if (!normalizedQuery) return true;

    const sender = getContact(email.senderId);
    const haystack = [
      email.subject,
      email.body.join(' '),
      sender?.name ?? '',
      sender?.email ?? '',
      email.senderId,
      email.attachments.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const activeEmail =
    emails.find((e) => e.id === activeEmailId) ?? filteredEmails[0] ?? null;

  const emailChoices = activeEmail
    ? activeChoices.filter(
        (c) => c.channel === 'email' && c.targetId === activeEmail.id
      )
    : [];

  const unreadCount = emails.filter((e) => !e.read).length;

  return (
    <div className="flex h-full w-full bg-white text-slate-900">
      {/* Left Pane: Inbox List */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-[#f8f9fa]">
        <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Inbox className="h-4 w-4 text-[#0067c0]" />
            Inbox
          </div>
          {unreadCount > 0 && (
            <span className="rounded bg-[#e5f1fb] px-2 py-0.5 text-[10px] font-semibold text-[#005aa8]">
              {unreadCount} unread
            </span>
          )}
        </div>

        {/* Search & Filter Controls */}
        <div className="border-b border-slate-200 bg-white px-2.5 py-2 space-y-2">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="w-full rounded border border-slate-200 bg-[#f8f9fa] py-1 pr-6 pl-7 text-[11px] text-slate-800 outline-none focus:border-[#0067c0] focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear mail search"
                className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'unread', 'flagged'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize transition cursor-pointer ${
                  filterMode === mode
                    ? 'bg-[#0067c0] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80">
          {filteredEmails.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              {sortedEmails.length === 0
                ? 'Your inbox is currently empty.'
                : 'No emails match your filter.'}
            </div>
          ) : (
            filteredEmails.map((email) => {
              const sender = getContact(email.senderId);
              const isSelected = activeEmail?.id === email.id;

              return (
                <div
                  key={email.id}
                  onClick={() => selectEmail(email.id)}
                  className={`group flex flex-col gap-1 border-l-[3px] px-3.5 py-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-l-[#0067c0] bg-[#e5f1fb]'
                      : !email.read
                        ? 'border-l-[#0067c0] bg-white hover:bg-slate-100'
                        : 'border-l-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!email.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#0067c0]" />
                      )}
                      <span
                        className={`truncate text-xs ${
                          email.read
                            ? 'font-medium text-slate-700'
                            : 'font-bold text-slate-950'
                        }`}
                      >
                        {sender?.name ?? email.senderId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] text-slate-500">
                        {email.timestamp}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEmailFlag(email.id);
                        }}
                        aria-label="Toggle flag"
                        className="rounded p-0.5 hover:bg-slate-200 cursor-pointer"
                      >
                        <Flag
                          className={`h-3 w-3 ${
                            email.flagged
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-slate-300 group-hover:text-slate-500'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`truncate text-xs ${
                      email.read ? 'text-slate-700' : 'font-semibold text-slate-950'
                    }`}
                  >
                    {email.subject}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-slate-500">
                      {email.body[0] || ''}
                    </span>
                    {email.attachments.length > 0 && (
                      <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Pane: Reading View */}
      <section className="flex flex-1 min-w-0 flex-col bg-white">
        {activeEmail ? (
          <>
            <header className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900 leading-snug">
                  {activeEmail.subject}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleEmailFlag(activeEmail.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition cursor-pointer ${
                    activeEmail.flagged
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      activeEmail.flagged ? 'fill-amber-500 text-amber-500' : ''
                    }`}
                  />
                  {activeEmail.flagged ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {(() => {
                const sender = getContact(activeEmail.senderId);
                return (
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{
                          backgroundColor: sender?.avatarColor ?? '#475569',
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      >
                        {sender?.avatarInitials ?? '??'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {sender?.name ?? activeEmail.senderId}{' '}
                          <span className="text-slate-500 font-normal">
                            &lt;{sender?.email ?? `${activeEmail.senderId}@local`}&gt;
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          To: You · {sender?.role ?? 'Staff'}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {activeEmail.timestamp}
                    </span>
                  </div>
                );
              })()}
            </header>

            {/* Email Body + Attachments + Sent Replies */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-3 text-[13.5px] leading-relaxed text-[#1f2328]">
                {activeEmail.body.map((para, idx) => (
                  <p key={idx} className="whitespace-pre-wrap">
                    {para}
                  </p>
                ))}
              </div>

              {activeEmail.attachments.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({activeEmail.attachments.length})
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeEmail.attachments.map((attPath) => (
                      <AttachmentCard key={attPath} path={attPath} />
                    ))}
                  </div>
                </div>
              )}

              {activeEmail.replies.length > 0 && (
                <div className="border-t border-slate-200 pt-4 space-y-2.5">
                  {activeEmail.replies.map((reply, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-[#cde0f5] bg-[#f4f8fd] p-3.5"
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-[#005aa8]">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sent Reply
                        </span>
                        <span className="font-mono">{reply.sentAt}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-800">
                        {reply.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multiple-Choice Email Reply Actions */}
            {emailChoices.length > 0 && (
              <footer className="border-t border-slate-200 bg-[#f8f9fa] px-6 py-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Reply className="h-3.5 w-3.5 text-[#0067c0]" />
                  Reply Actions
                </div>
                <div className="flex flex-col gap-2">
                  {emailChoices.map((choice) => (
                    <button
                      key={choice.index}
                      type="button"
                      onClick={() => selectChoice(choice.index)}
                      className="flex items-center justify-between rounded border border-slate-300 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-800 transition hover:border-[#0067c0] hover:bg-[#edf5fc] hover:text-[#004e96] cursor-pointer"
                    >
                      <span>{choice.text}</span>
                      <span className="ml-3 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#0067c0]">
                        Send
                      </span>
                    </button>
                  ))}
                </div>
              </footer>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <MailOpen className="mb-2 h-9 w-9 opacity-35" />
            <p className="text-xs">Select an email to read.</p>
          </div>
        )}
      </section>
    </div>
  );
}
