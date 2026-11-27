import { Flag, Inbox, MailOpen, Paperclip, Reply, CheckCircle2 } from 'lucide-react';
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

  const sortedEmails = [...emails].reverse();
  const activeEmail =
    emails.find((e) => e.id === activeEmailId) ?? sortedEmails[0] ?? null;

  const getContact = (senderId: string) =>
    contacts.find((c) => c.id === senderId);

  const emailChoices = activeEmail
    ? activeChoices.filter(
        (c) => c.channel === 'email' && c.targetId === activeEmail.id
      )
    : [];

  const unreadCount = emails.filter((e) => !e.read).length;

  return (
    <div className="flex h-full w-full">
      {/* Left Pane: Inbox List */}
      <aside className="flex w-76 shrink-0 flex-col border-r border-slate-800 bg-slate-900/75">
        <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Inbox className="h-4 w-4 text-sky-400" />
            Inbox
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
          {sortedEmails.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Your inbox is currently empty.
            </div>
          ) : (
            sortedEmails.map((email) => {
              const sender = getContact(email.senderId);
              const isSelected = activeEmail?.id === email.id;

              return (
                <div
                  key={email.id}
                  onClick={() => selectEmail(email.id)}
                  className={`group flex flex-col gap-1 px-3.5 py-3 transition cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 border-l-2 border-l-sky-400'
                      : 'hover:bg-slate-800/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!email.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                      )}
                      <span
                        className={`truncate text-xs ${
                          email.read
                            ? 'font-medium text-slate-300'
                            : 'font-bold text-slate-100'
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
                        className="rounded p-0.5 hover:bg-slate-700 cursor-pointer"
                      >
                        <Flag
                          className={`h-3 w-3 ${
                            email.flagged
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600 group-hover:text-slate-400'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`truncate text-xs ${
                      email.read ? 'text-slate-300' : 'font-semibold text-white'
                    }`}
                  >
                    {email.subject}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-slate-400">
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
      <section className="flex flex-1 min-w-0 flex-col bg-slate-950/40">
        {activeEmail ? (
          <>
            <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-100 leading-snug">
                  {activeEmail.subject}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleEmailFlag(activeEmail.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition cursor-pointer ${
                    activeEmail.flagged
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flag
                    className={`h-3.5 w-3.5 ${
                      activeEmail.flagged ? 'fill-amber-400 text-amber-400' : ''
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
                          backgroundColor: sender?.avatarColor ?? '#334155',
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      >
                        {sender?.avatarInitials ?? '??'}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">
                          {sender?.name ?? activeEmail.senderId}{' '}
                          <span className="text-slate-400 font-normal">
                            &lt;{sender?.email ?? `${activeEmail.senderId}@local`}&gt;
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          To: You · {sender?.role ?? 'Staff'}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-400">
                      {activeEmail.timestamp}
                    </span>
                  </div>
                );
              })()}
            </header>

            {/* Email Body + Attachments + Sent Replies */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-200">
                {activeEmail.body.map((para, idx) => (
                  <p key={idx} className="whitespace-pre-wrap">
                    {para}
                  </p>
                ))}
              </div>

              {activeEmail.attachments.length > 0 && (
                <div className="border-t border-slate-800/80 pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
                  {activeEmail.replies.map((reply, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5"
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-sky-300">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sent Reply
                        </span>
                        <span className="font-mono">{reply.sentAt}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-100">
                        {reply.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multiple-Choice Email Reply Actions */}
            {emailChoices.length > 0 && (
              <footer className="border-t border-slate-800 bg-slate-900/75 px-6 py-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                  <Reply className="h-3.5 w-3.5" />
                  Select Reply Action
                </div>
                <div className="flex flex-col gap-2">
                  {emailChoices.map((choice) => (
                    <button
                      key={choice.index}
                      type="button"
                      onClick={() => selectChoice(choice.index)}
                      className="flex items-center justify-between rounded-lg border border-sky-500/35 bg-sky-500/10 px-3.5 py-2 text-left text-xs font-medium text-sky-100 transition hover:border-sky-400 hover:bg-sky-500/20 cursor-pointer"
                    >
                      <span>{choice.text}</span>
                      <span className="ml-3 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                        Send
                      </span>
                    </button>
                  ))}
                </div>
              </footer>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
            <MailOpen className="mb-2 h-9 w-9 opacity-35" />
            <p className="text-xs">Select an email to read.</p>
          </div>
        )}
      </section>
    </div>
  );
}
