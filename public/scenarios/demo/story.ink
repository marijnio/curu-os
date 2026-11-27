VAR player_name = "Analyst"
VAR posture = "undecided"
VAR listened_to_intro = false

-> intro

=== intro ===
# CHANNEL: chat
# SENDER: system_guide
Good morning, {player_name}. Terminal 04B just finished syncing your desk workspace.
I left a quick voice briefing below before Elena pings you for the 9:30 standup.
# VOICE_NOTE: media/welcome_briefing.mp3 \| duration: 0:11 \| transcript: Morning, welcome to Meridian Archive. Before Elena pulls you into the 9:30 standup, check your Messages for the Day 1 briefing file and verify anything marked overnight. Talk in a sec.
Take a listen whenever you're ready, or let me know if everything looks good on your screen.

+ [Just finished listening — all set.]
    ~ listened_to_intro = true
    -> send_briefing
+ [Everything synced cleanly. What's on deck first?]
    -> send_briefing

=== send_briefing ===
# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 4
# ATTACHMENT: docs/day1_briefing.md
# FILE_UNLOCK: media/sector_badge.png
Great. I'm sending over your Day 1 shift briefing now, plus the Vault 4 credential schematic into your Images folder.
Open Day1_Briefing.md from the card above (or in File Explorer) so I can mark your onboarding step complete. # EVENT_HOOK: on_file_open:docs/day1_briefing.md => after_briefing_opened
-> DONE

=== after_briefing_opened ===
# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 7
Nice — I see you opened the briefing. Notice that 02:14 AM note on Vault 4?
Elena just dropped a message in your Mail inbox with the raw door extract attached. Might want to check both before replying to her.

# CHANNEL: email
# SENDER: elena_vance
# SUBJECT: Quick check-in before the 9:30 sync
# ATTACHMENT: docs/access_log_extract.md
# FLAG_EMAIL
Morning {player_name},
Welcome to Intake & Audit. I know it's barely past nine, but the overnight controller flagged a brief entry in Archive Vault 4 around 02:14 AM with no maintenance ticket attached.
I've attached the raw access extract. Take a look when you have a minute and let me know how you want to log this before the 9:30 floor sync.
— Elena

+ [Log a formal discrepancy report for TEMP-19 and request a lockbox audit.]
    ~ posture = "formal_audit"
    -> branch_formal
+ [Ask Elena privately if anyone in Operations borrowed TEMP-19 over the weekend.]
    ~ posture = "quiet_check"
    -> branch_quiet
+ [Sign off on the log as a harmless test swipe so we don't stall the 9:30 sync.]
    ~ posture = "dismissed"
    -> branch_dismiss

=== branch_formal ===
# CHANNEL: email
# SENDER: elena_vance
# SUBJECT: Re: Quick check-in before the 9:30 sync
# ADVANCE_TIME: 8
Understood. Filing a formal lockbox audit now — Security won't love the extra paperwork before noon, but the missing 9-minute camera window makes it hard to ignore.
I'll put you on the follow-up thread after standup.

# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 2
By-the-book call. Your audit flag is logged, and Elena marked Vault 4 for physical inspection.
That wraps up the Curu-OS demo shift — feel free to inspect any remaining files or reset the scenario from the Start Menu.
-> END

=== branch_quiet ===
# CHANNEL: email
# SENDER: elena_vance
# SUBJECT: Re: Quick check-in before the 9:30 sync
# ADVANCE_TIME: 8
Good instinct checking quietly first. Between us, two badges were supposed to be re-keyed on Friday and the front desk log has been sloppy all month.
Let me check with Facilities before we trigger a full floor audit — keep the extract open on your desk for 9:30.

# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 2
Measured approach. Elena appreciates the heads-up before escalating, though `TEMP-19` is still unaccounted for.
That wraps up the Curu-OS demo shift — feel free to inspect any remaining files or reset the scenario from the Start Menu.
-> END

=== branch_dismiss ===
# CHANNEL: email
# SENDER: elena_vance
# SUBJECT: Re: Quick check-in before the 9:30 sync
# ADVANCE_TIME: 8
Fair enough — I'll mark it as an unscheduled test swipe for the 9:30 summary. Still, if `TEMP-19` turns up again tonight, Security is going to ask who signed off on this morning's sheet.

# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 2
Log cleared for now — though clearing a pool badge entry alongside a camera reboot might come back around later.
That wraps up the Curu-OS demo shift — feel free to inspect any remaining files or reset the scenario from the Start Menu.
-> END
