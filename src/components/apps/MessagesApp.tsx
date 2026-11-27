import { useEffect, useRef } from 'react';
import { Pin, MessageCircle, Lock } from 'lucide-react';
import { useOsStore } from '../../store/useOsStore';
import { AudioPlayer } from '../shared/AudioPlayer';
import { AttachmentCard } from '../shared/AttachmentCard';

export function MessagesApp() {
  const contacts = useOsStore((s) => s.contacts);
  const activeContactId = useOsStore((s) => s.activeContactId);
  const chatMessages = useOsStore((s) => s.chatMessages);
  const unreadChatCounts = useOsStore((s) => s.unreadChatCounts);
  const typingContactId = useOsStore((s) => s.typingContactId);
  const activeChoices = useOsStore((s) => s.activeChoices);
  const pendingHooks = useOsStore((s) => s.pendingHooks);

  const selectContact = useOsStore((s) => s.selectContact);
  const selectChoice = useOsStore((s) => s.selectChoice);
  const openFileInExplorer = useOsStore((s) => s.openFileInExplorer);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const pinnedContacts = contacts.filter((c) => c.pinned);
  const regularContacts = contacts.filter((c) => !c.pinned);

  const activeContact =
    contacts.find((c) => c.id === activeContactId) ?? contacts[0] ?? null;

  const threadMessages = activeContact
    ? chatMessages.filter((m) => m.contactId === activeContact.id)
    : [];

  const threadChoices = activeContact
    ? activeChoices.filter(
        (c) => c.channel === 'chat' && c.targetId === activeContact.id
      )
    : [];

  const isTyping = Boolean(activeContact && typingContactId === activeContact.id);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, isTyping, activeContact?.id]);

  const renderContactRow = (contact: (typeof contacts)[number]) => {
    const isActive = activeContact?.id === contact.id;
    const unread = unreadChatCounts[contact.id] ?? 0;
    const contactMsgs = chatMessages.filter((m) => m.contactId === contact.id);
    const lastMsg = contactMsgs[contactMsgs.length - 1];

    const preview = lastMsg
      ? lastMsg.kind === 'voice_note'
        ? 'Voice message'
        : lastMsg.kind === 'attachment'
          ? 'Sent a file'
          : lastMsg.text
      : contact.role;

    return (
      <button
        key={contact.id}
        type="button"
        onClick={() => selectContact(contact.id)}
        className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors cursor-pointer ${
          isActive
            ? 'border-l-[#0067c0] bg-[#e6f0fa]'
            : 'border-l-transparent hover:bg-slate-200/60'
        }`}
      >
        <div className="relative shrink-0">
          <div
            style={{ backgroundColor: contact.avatarColor }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
          >
            {contact.avatarInitials}
          </div>
          <span
            className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#f7f8fa] ${
              contact.status === 'away'
                ? 'bg-amber-400'
                : contact.status === 'offline'
                  ? 'bg-slate-400'
                  : 'bg-[#25b864]'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-xs font-semibold text-slate-900">
              {contact.name}
            </span>
            {lastMsg && (
              <span className="shrink-0 font-mono text-[10px] text-slate-500">
                {lastMsg.timestamp}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-slate-500">{preview}</span>
            {unread > 0 && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#25b864] px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full bg-white text-slate-900">
      {/* Left Sidebar: Contacts */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-[#f7f8fa]">
        <div className="border-b border-slate-200 px-3.5 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Contacts
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 space-y-2">
          {pinnedContacts.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Pin className="h-3 w-3 text-[#0067c0]" />
                Pinned
              </div>
              <div>{pinnedContacts.map(renderContactRow)}</div>
            </div>
          )}

          {regularContacts.length > 0 && (
            <div>
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Colleagues
              </div>
              <div>{regularContacts.map(renderContactRow)}</div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Thread */}
      <section className="flex flex-1 min-w-0 flex-col bg-[#f0f2f5]">
        {activeContact ? (
          <>
            {/* Thread Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: activeContact.avatarColor }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {activeContact.avatarInitials}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {activeContact.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {activeContact.role}
                  </div>
                </div>
              </div>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Internal Chat
              </span>
            </header>

            {/* Messages Timeline */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
              {threadMessages.length === 0 && !isTyping && (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <MessageCircle className="mb-2 h-8 w-8 opacity-40" />
                  <p className="text-xs">No messages with {activeContact.name} yet.</p>
                </div>
              )}

              {threadMessages.map((msg) => {
                const isPlayer = msg.sender === 'player';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isPlayer ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[78%] rounded-lg px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
                        isPlayer
                          ? 'rounded-br-[2px] border border-[#c5e8aa] bg-[#dcf8c6] text-slate-900'
                          : 'rounded-bl-[2px] border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {msg.text && (
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}

                      {msg.kind === 'voice_note' && msg.voiceNote && (
                        <div className={msg.text ? 'mt-2' : ''}>
                          <AudioPlayer
                            path={msg.voiceNote.path}
                            durationHint={msg.voiceNote.duration}
                            transcript={msg.voiceNote.transcript}
                            variant="compact"
                            onOpenInExplorer={() =>
                              openFileInExplorer(msg.voiceNote!.path)
                            }
                          />
                        </div>
                      )}

                      {msg.kind === 'attachment' && msg.attachmentPath && (
                        <div className={msg.text ? 'mt-2' : ''}>
                          <AttachmentCard path={msg.attachmentPath} compact />
                        </div>
                      )}

                      <div className="mt-1 text-right font-mono text-[10px] text-slate-400">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-start">
                  <div className="flex items-center gap-1.5 rounded-lg rounded-bl-[2px] border border-slate-200 bg-white px-3.5 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>

            {/* Multiple-Choice Response Footer (no free-text typing) */}
            <footer className="border-t border-slate-200 bg-[#f7f8fa] px-4 py-3">
              {threadChoices.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Choose a reply
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {threadChoices.map((choice) => (
                      <button
                        key={choice.index}
                        type="button"
                        onClick={() => selectChoice(choice.index)}
                        className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 shadow-2xs transition hover:border-[#0067c0] hover:bg-[#eef6fc] hover:text-[#004e96] cursor-pointer"
                      >
                        {choice.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    {isTyping
                      ? `${activeContact.name} is typing...`
                      : pendingHooks.length > 0
                        ? 'Open the shared file in File Explorer to continue.'
                        : activeChoices.some((c) => c.channel === 'email')
                          ? 'A reply is waiting in Mail.'
                          : activeChoices.length > 0
                            ? 'Active conversation is in another thread.'
                            : 'No reply needed right now.'}
                  </span>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
            Select a contact to view messages.
          </div>
        )}
      </section>
    </div>
  );
}
