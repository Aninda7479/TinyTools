pub const CHAT_HTML: &str = r####"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>TinyTools — E2EE Local Chat</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --bg: #07070a;
  --bg-panel: rgba(18, 18, 26, 0.75);
  --bg-glass: rgba(255, 255, 255, 0.02);
  --bg-glass-hover: rgba(255, 255, 255, 0.06);
  --bg-glass-active: rgba(255, 255, 255, 0.1);
  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);
  --border-focus: rgba(96, 165, 250, 0.45);
  --accent: linear-gradient(135deg, #60a5fa, #3b82f6);
  --accent-solid: #3b82f6;
  --accent-glow: rgba(59, 130, 246, 0.25);
  --text: #f3f4f6;
  --text-muted: rgba(255, 255, 255, 0.4);
  --green: #10b981;
  --green-glow: rgba(16, 185, 129, 0.15);
  --red: #ef4444;
  --red-glow: rgba(239, 68, 68, 0.2);
  --yellow: #f59e0b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--bg);
  background-image: 
    radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.07) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.07) 0px, transparent 50%),
    radial-gradient(at 50% 50%, #09090e 0%, #030305 100%);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
  outline: none;
}

input, textarea {
  font-family: inherit;
}

svg {
  display: block;
}

/* Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.18);
}

/* Gate page styling (Join Room Screen) */
#gate {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
  z-index: 1000;
}

.gate-card {
  width: 100%;
  max-width: 400px;
  background: rgba(15, 15, 22, 0.65);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 2rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleUp {
  from { transform: scale(0.93); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.gate-logo {
  width: 60px;
  height: 60px;
  border-radius: 1.1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.25rem;
}

.gate-logo svg {
  width: 28px;
  height: 28px;
  color: #60a5fa;
}

h1 {
  font-size: 1.35rem;
  text-align: center;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
  margin: 0.4rem 0 1.25rem;
}

.lock-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--green);
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(16, 185, 129, 0.08);
  padding: 0.35rem 0.85rem;
  border-radius: 99px;
  border: 1px solid rgba(16, 185, 129, 0.15);
  margin: 0 auto 1.5rem;
  width: fit-content;
}

.field {
  margin-bottom: 1.1rem;
}

.field label {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.45rem;
}

.field input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s ease;
}

.field input:focus {
  border-color: var(--border-focus);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
}

.btn {
  width: 100%;
  padding: 0.8rem;
  border-radius: 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.45);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.error {
  color: var(--red);
  font-size: 0.78rem;
  margin-top: 0.8rem;
  display: none;
  text-align: center;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 0.5rem;
  border-radius: 0.7rem;
}

.hint {
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.7rem;
  text-align: center;
  margin-top: 1.5rem;
  line-height: 1.5;
}

/* Chat Layout Screen */
#chat {
  display: none;
  position: fixed;
  inset: 0;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 13, 17, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 10;
}

.chat-header .header-left {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.chat-header .logo-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-header .logo-wrapper svg {
  width: 18px;
  height: 18px;
  color: #60a5fa;
}

.chat-header .title-section {
  display: flex;
  flex-direction: column;
}

.chat-header .title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.chat-header .meta {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.chat-header .header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* Layout Switcher (active inside calls on tablet/mobile) */
.layout-tabs {
  display: none;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  padding: 0.25rem;
  border-radius: 0.75rem;
  gap: 0.25rem;
}

.layout-tabs .tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  border-radius: 0.55rem;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-tabs .tab-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.2);
  background: rgba(16, 185, 129, 0.08);
  color: var(--green);
  white-space: nowrap;
}

.btn-ghost {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.45rem 0.9rem;
  border-radius: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
}

.btn-ghost:hover {
  color: #fff;
  border-color: var(--border-hover);
  background: var(--bg-glass-hover);
}

.btn-ghost.danger {
  color: var(--red);
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.15);
}

.btn-ghost.danger:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-ghost.call-btn {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.15);
}

.btn-ghost.call-btn:hover {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
}

.ephemeral {
  text-align: center;
  font-size: 0.7rem;
  color: rgba(245, 158, 11, 0.85);
  background: rgba(245, 158, 11, 0.05);
  border-bottom: 1px solid rgba(245, 158, 11, 0.12);
  padding: 0.4rem 1rem;
  font-weight: 500;
}

.chat-body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* Roster / Members Sidebar Drawer */
.roster {
  width: 240px;
  border-right: 1px solid var(--border);
  background: rgba(13, 13, 17, 0.3);
  padding: 1.25rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease, border 0.3s ease;
  flex-shrink: 0;
}

#chat.roster-hidden .roster {
  width: 0;
  padding: 0;
  border-right: none;
  overflow: hidden;
}

.roster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.roster h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-weight: 600;
}

.roster .close-drawer {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.3rem;
  cursor: pointer;
}

.roster .member {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.8rem;
  transition: background 0.2s;
}

.roster .member:hover {
  background: rgba(255, 255, 255, 0.03);
}

.roster .member .m-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.68rem;
  color: #fff;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.roster .member .m-status-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--green);
  border: 1.5px solid #0f0f13;
}

.roster .member .name {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.roster-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 90;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.roster-backdrop.active {
  display: block;
  opacity: 1;
}

/* Chat Main Panel */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
  background: rgba(13, 13, 17, 0.1);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.sys-notice {
  align-self: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  padding: 0.35rem 1rem;
  border-radius: 99px;
  margin: 0.3rem 0;
}

/* Message layouts */
.msg {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.3rem;
  max-width: 78%;
  align-items: flex-start;
  opacity: 0;
  transform: translateY(8px);
  animation: msgFadeIn 0.3s forwards ease-out;
}

@keyframes msgFadeIn {
  to { opacity: 1; transform: translateY(0); }
}

.msg.own {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.msg.other {
  flex-direction: row;
  align-self: flex-start;
}

.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.msg-body {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 44px);
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.72rem;
}

.msg.own .msg-header {
  flex-direction: row-reverse;
}

.msg-sender {
  font-weight: 600;
  color: #60a5fa;
}

.msg.own .msg-sender {
  color: #c084fc;
}

.msg-time {
  color: var(--text-muted);
  font-size: 0.65rem;
}

.bubble {
  padding: 0.65rem 0.95rem;
  border-radius: 1.1rem;
  font-size: 0.85rem;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.msg.other .bubble {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-top-left-radius: 0.25rem;
  color: #e5e7eb;
}

.msg.own .bubble {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-top-right-radius: 0.25rem;
  color: #ffffff;
}

/* Image attachment bubble */
.msg .img-wrap {
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--border);
  max-width: 320px;
  background: rgba(255, 255, 255, 0.02);
  cursor: zoom-in;
  margin-top: 0.25rem;
  transition: border-color 0.2s;
}

.msg .img-wrap:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.msg img {
  display: block;
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
}

/* File attachments */
.file-card {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  min-width: 240px;
  max-width: 350px;
  margin-top: 0.25rem;
  transition: all 0.2s;
}

.file-card:hover {
  border-color: var(--border-hover);
  background: rgba(255, 255, 255, 0.05);
}

.file-card .fic {
  width: 40px;
  height: 40px;
  border-radius: 0.75rem;
  background: rgba(59, 130, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-card .fic svg {
  width: 20px;
  height: 20px;
  color: var(--accent-solid);
}

.file-card .meta {
  flex: 1;
  min-width: 0;
}

.file-card .fname {
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-card .fsize {
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.file-card .dbtn {
  background: rgba(16, 185, 129, 0.12);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.25);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: 0.7rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.file-card .dbtn:hover {
  background: rgba(16, 185, 129, 0.2);
  transform: translateY(-1px);
}

.file-card .dbtn.loading {
  opacity: 0.55;
  cursor: wait;
}

/* Composer Panel */
.composer {
  border-top: 1px solid var(--border);
  padding: 1rem 1.5rem;
  background: rgba(13, 13, 17, 0.5);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

.pending {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pending .pchip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  padding: 0.35rem 0.75rem;
  border-radius: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}

.pending .pchip .x {
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  transition: color 0.2s;
}

.pending .pchip .x:hover {
  color: var(--red);
}

.composer-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.composer textarea {
  flex: 1;
  resize: none;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  color: #fff;
  font-size: 0.875rem;
  padding: 0.65rem 1.1rem;
  outline: none;
  height: 40px;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.45;
  overflow-y: hidden;
  transition: all 0.2s ease;
}

.composer textarea:focus {
  border-color: var(--border-focus);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.1);
}

.btn-attach {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 44px;
  height: 44px;
  border-radius: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.btn-attach:hover {
  color: #fff;
  border-color: var(--border-hover);
  background: var(--bg-glass-hover);
  transform: translateY(-1px);
}

.btn-send {
  background: var(--accent-solid);
  color: #fff;
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  box-shadow: 0 4px 12px var(--accent-glow);
}

.btn-send:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.45);
}

.composer-hint {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 0.6rem;
  text-align: center;
}

/* Call Panel styling */
#callPanel {
  display: none;
  width: 460px;
  max-width: 50%;
  flex-direction: column;
  min-height: 0;
  position: relative;
  border-left: 1px solid var(--border);
  background: rgba(10, 10, 14, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.25);
}

#callPanel.active {
  display: flex;
}

.call-panel-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--border);
}

.call-panel-head .t {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
}

.call-panel-head .p {
  font-size: 0.72rem;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.15rem 0.55rem;
  border-radius: 99px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

.call-panel-head .spacer {
  flex: 1;
}

.call-head-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.call-head-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
  background: var(--bg-glass-hover);
}

.call-panel-body {
  flex: 1;
  position: relative;
  min-height: 0;
  background: #020204;
}

#remoteVideos {
  position: absolute;
  inset: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem;
  justify-content: center;
  align-content: center;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
  background: #020204;
}

.remote-cell {
  position: relative;
  border-radius: 1.1rem;
  overflow: hidden;
  border: 1px solid var(--border);
  background: #0d0d12;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-cell:hover {
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 25px rgba(0,0,0,0.5);
}

/* Layout formulas to fit exactly without scrolling */
#remoteVideos.count-0 .remote-cell {
  display: none;
}
#remoteVideos.count-1 .remote-cell {
  width: 100%;
  height: 100%;
}
#remoteVideos.count-2 .remote-cell {
  width: calc(50% - 0.25rem);
  height: 100%;
}
#remoteVideos.count-3 .remote-cell,\
#remoteVideos.count-4 .remote-cell {
  width: calc(50% - 0.25rem);
  height: calc(50% - 0.25rem);
}
#remoteVideos.count-5 .remote-cell,\
#remoteVideos.count-6 .remote-cell {
  width: calc(33.33% - 0.35rem);
  height: calc(50% - 0.25rem);
}
#remoteVideos.count-7 .remote-cell,\
#remoteVideos.count-8 .remote-cell,\
#remoteVideos.count-9 .remote-cell {
  width: calc(33.33% - 0.35rem);
  height: calc(33.33% - 0.35rem);
}

/* responsive overrides for count layouts */
@media (max-width: 767px) {
  #remoteVideos.count-2 .remote-cell {
    width: 100%;
    height: calc(50% - 0.25rem);
  }
  #remoteVideos.count-3 .remote-cell {
    width: 100%;
    height: calc(33.33% - 0.35rem);
  }
  #remoteVideos.count-4 .remote-cell {
    width: calc(50% - 0.25rem);
    height: calc(50% - 0.25rem);
  }
  #remoteVideos.count-5 .remote-cell,\
  #remoteVideos.count-6 .remote-cell {
    width: calc(50% - 0.25rem);
    height: calc(33.33% - 0.35rem);
  }
}

/* Pinned/Featured Layout Rules */
#remoteVideos:has(.featured) .remote-cell.featured {
  width: 100% !important;
  height: calc(72% - 0.25rem) !important;
}
#remoteVideos:has(.featured) .remote-cell:not(.featured) {
  width: calc(25% - 0.38rem) !important;
  height: calc(28% - 0.25rem) !important;
}
@media (max-width: 767px) {
  #remoteVideos:has(.featured) .remote-cell.featured {
    height: calc(60% - 0.25rem) !important;
  }
  #remoteVideos:has(.featured) .remote-cell:not(.featured) {
    width: calc(50% - 0.25rem) !important;
    height: calc(20% - 0.25rem) !important;
  }
}

/* Video Placeholder when Camera Off */
.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #1b1b26 0%, #0c0c10 100%);
  color: #fff;
  z-index: 0;
}

.video-placeholder .v-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  margin-bottom: 0.5rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.video-placeholder .v-status {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 500;
}

.remote-cell video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  z-index: 1;
  transition: opacity 0.35s ease;
}

.remote-cell.cam-muted video {
  opacity: 0;
  pointer-events: none;
}

.remote-name {
  position: absolute;
  bottom: 10px;
  left: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  background: rgba(10, 10, 15, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 0.3rem 0.7rem;
  border-radius: 0.6rem;
  z-index: 2;
  pointer-events: none;
}

.pin-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(10, 10, 15, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  opacity: 0;
  transition: all 0.2s;
}

.remote-cell:hover .pin-btn {
  opacity: 1;
}

.pin-btn:hover {
  background: rgba(10,10,15,0.8);
  transform: scale(1.05);
}

.pin-btn.pinned {
  opacity: 1;
  background: var(--accent-solid);
  border-color: rgba(255,255,255,0.25);
  box-shadow: 0 4px 10px var(--accent-glow);
}

/* Local Video PIP Frame */
#callLocalWrap {
  position: absolute;
  bottom: 5.5rem;
  right: 1rem;
  width: 140px;
  height: 90px;
  border-radius: 0.8rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 5;
  background: #111115;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

#callLocalWrap:hover {
  transform: scale(1.05);
  border-color: var(--accent-solid);
}

#callLocalWrap video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
  z-index: 1;
  transition: opacity 0.3s;
}

#callLocalWrap.cam-muted video {
  opacity: 0;
  pointer-events: none;
}

#callLocalWrap .video-placeholder .v-avatar {
  width: 36px;
  height: 36px;
  font-size: 0.9rem;
  margin-bottom: 0.2rem;
}

#callLocalWrap .video-placeholder .v-status {
  font-size: 0.55rem;
}

#callStatus {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  text-align: center;
  z-index: 4;
  pointer-events: none;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  padding: 0.6rem 1.25rem;
  border-radius: 99px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}

/* Float Controls for calls */
.call-controls {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
  background: rgba(15, 15, 20, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.55rem 0.9rem;
  border-radius: 99px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s;
}

.call-controls button {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.call-controls button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.call-controls button.danger {
  background: var(--red);
  border-color: rgba(239, 68, 68, 0.2);
  box-shadow: 0 4px 12px var(--red-glow);
}

.call-controls button.danger:hover {
  background: #dc2626;
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.45);
}

.call-controls button.off {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--red);
}

/* Join Video Call banner overlay */
#joinBar {
  display: none;
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 80;
  align-items: center;
  gap: 1rem;
  background: rgba(59, 130, 246, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(59, 130, 246, 0.35);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.6rem 0.8rem 0.6rem 1.2rem;
  border-radius: 99px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDown {
  from { transform: translate(-50%, -20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}

#joinBar button {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 0.45rem 1.2rem;
  border-radius: 99px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}

#joinBar button:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

/* Roster / chat layout switches */
#chat.in-call .roster {
  display: none;
}

#chat.in-call .chat-main {
  width: 320px;
  flex: none;
  border-left: 1px solid var(--border);
}

#chat.in-call #callPanel {
  flex: 1;
  max-width: none;
  width: auto;
}

#callPanel:fullscreen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-left: none;
  background: #020204;
}

#callPanel:fullscreen #remoteVideos {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

/* Floating Actions in call for Mobile */
#floatingChatBtn, #floatingVideoBtn {
  display: none;
}

/* Drag overlay panel */
.drag-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(59, 130, 246, 0.08);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 3px dashed var(--accent-solid);
  border-radius: 1.5rem;
  margin: 1rem;
  z-index: 10000;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  pointer-events: none;
  box-shadow: inset 0 0 40px rgba(59, 130, 246, 0.15);
}

.drag-overlay.active {
  display: flex;
}

/* Media Breakpoints */
@media(min-width: 1024px) {
  /* Toggle Roster on Desktop */
  #chat.roster-hidden .roster {
    width: 0;
    padding: 0;
    border-right: none;
  }
  
  /* In call layout roster toggle on Desktop */
  #chat.in-call.roster-visible .roster {
    display: flex;
  }
}

@media(max-width: 1023px) {
  /* Tablet Breakpoints */
  #chat.in-call .chat-body {
    flex-direction: column;
  }
  
  #chat.in-call .chat-main {
    width: 100%;
    border-left: none;
  }
  
  /* Mobile layout switcher visibility */
  #chat.in-call .layout-tabs {
    display: inline-flex;
  }
  
  /* Apply Layout choices */
  #chat.in-call.layout-split #callPanel {
    display: flex;
    height: 42vh;
    width: 100%;
    border-left: none;
    border-bottom: 1px solid var(--border);
  }
  #chat.in-call.layout-split .chat-main {
    display: flex;
    flex: 1;
    width: 100%;
    min-height: 0;
  }
  
  #chat.in-call.layout-video #callPanel {
    display: flex;
    height: 100%;
    width: 100%;
    border-left: none;
  }
  #chat.in-call.layout-video .chat-main {
    display: none !important;
  }
  #chat.in-call.layout-video #floatingChatBtn {
    display: flex;
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent-solid);
    color: white;
    box-shadow: 0 8px 24px var(--accent-glow);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    z-index: 20;
    transition: transform 0.2s;
  }
  #chat.in-call.layout-video #floatingChatBtn:hover {
    transform: scale(1.05);
  }
  
  #chat.in-call.layout-chat #callPanel {
    display: none !important;
  }
  #chat.in-call.layout-chat .chat-main {
    display: flex;
    flex: 1;
    width: 100%;
  }
  #chat.in-call.layout-chat #floatingVideoBtn {
    display: flex;
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #10b981;
    color: white;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    z-index: 20;
    transition: transform 0.2s;
  }
  #chat.in-call.layout-chat #floatingVideoBtn:hover {
    transform: scale(1.05);
  }
  
  /* Slide out Members drawer */
  .roster {
    position: fixed;
    top: 0;
    left: -260px;
    bottom: 0;
    width: 250px;
    z-index: 100;
    background: #0b0b0e;
    border-right: 1px solid var(--border);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 10px 0 30px rgba(0,0,0,0.6);
  }
  
  .roster.active {
    left: 0;
  }
  
  .roster .close-drawer {
    display: block;
  }
}

@media(max-width: 767px) {
  /* Mobile Breakpoints */
  .chat-header {
    padding: 0.8rem 1rem;
  }
  
  .chat-header .title-section {
    display: none; /* Hide title to make space for layout switcher on mobile */
  }
  
  #chat.in-call .chat-header .title-section {
    display: none;
  }
  
  .msg {
    max-width: 90%;
  }
  
  #remoteVideos {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.5rem;
    padding: 0.5rem;
  }
  
  #callLocalWrap {
    width: 100px;
    height: 70px;
    bottom: 5rem;
  }
  
  .call-controls {
    bottom: 1rem;
  }
}

.bubble.gif-bubble {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0.25rem !important;
  max-width: 300px;
  border-radius: 1rem;
  overflow: hidden;
}

.bubble.gif-bubble img {
  display: block;
  max-width: 100%;
  border-radius: 1rem;
  border: 1px solid var(--border);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  background: #000;
}
</style>
</head>
<body>

<div id="dragOverlay" class="drag-overlay">Drop files here to share...</div>
<div id="rosterBackdrop" class="roster-backdrop" onclick="toggleRoster()"></div>

<div id="gate">
  <div class="gate-card">
    <div class="gate-logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
    <h1>E2EE Local Chat</h1>
    <p class="subtitle">Host/Join a room on your local network</p>
    <div class="lock-badge">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      End-to-end encrypted · zero logs
    </div>
    <div class="field">
      <label>Room password</label>
      <input type="password" id="password" placeholder="Enter the room password" autocomplete="off">
    </div>
    <div class="field">
      <label>Your name</label>
      <input type="text" id="name" placeholder="Display name" maxlength="24" autocomplete="off">
    </div>
    <button class="btn btn-primary" id="joinBtn" onclick="join()">Join Room</button>
    <div class="error" id="gateError"></div>
    <p class="hint">All messages are encrypted inside your browser before sending. Relayed ciphertext cannot be decrypted by the server or intermediaries.</p>
  </div>
</div>

<div id="chat">
  <div class="chat-header">
    <div class="header-left">
      <div class="logo-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div class="title-section">
        <span class="title">E2EE Local Chat</span>
        <span class="meta" id="memberCount">Connecting...</span>
      </div>
    </div>
    
    <!-- Mobile Layout selection inside calls -->
    <div id="callLayoutTabs" class="layout-tabs">
      <button class="tab-btn active" id="tabSplit" onclick="changeCallLayout('split')">Split</button>
      <button class="tab-btn" id="tabVideo" onclick="changeCallLayout('video')">Video</button>
      <button class="tab-btn" id="tabChat" onclick="changeCallLayout('chat')">Chat</button>
    </div>
    
    <div class="header-right">
      <button class="btn-ghost" id="rosterToggleBtn" onclick="toggleRoster()" title="Toggle Members">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Members</span>
      </button>
      <button class="btn-ghost call-btn" id="videoCallBtn" onclick="onVideoCallBtn()" title="Video Call">
        <svg id="videoCallIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
        <span id="videoCallLabel">Start Call</span>
      </button>
      <button class="btn-ghost danger" onclick="leave()">Leave</button>
    </div>
  </div>
  
  <div class="ephemeral">Ephemeral room — closing the browser or stopping the room erases all chat history permanently.</div>
  
  <div id="joinBar">
    <span id="joinBarText"></span>
    <button id="joinBarBtn" onclick="joinCall()">Join</button>
  </div>
  
  <div class="chat-body">
    <div class="roster" id="rosterDrawer">
      <div class="roster-header">
        <h3 id="rosterTitle">Members</h3>
        <button class="close-drawer" onclick="toggleRoster()">&times;</button>
      </div>
      <div id="rosterList"></div>
    </div>
    
    <div class="chat-main">
      <div class="messages" id="messages"></div>
      <div class="composer">
        <div class="pending" id="pending"></div>
        <div class="composer-row">
          <button class="btn-attach" onclick="document.getElementById('fileInput').click()" title="Attach file">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea id="input" placeholder="Type a message... (Enter to send)" rows="1"></textarea>
          <button class="btn-send" onclick="send()" title="Send">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
        <div class="composer-hint">Drag &amp; drop files/images anywhere or paste to attach · files are relayed in memory (max 50 MB)</div>
      </div>
    </div>
    
    <div id="callPanel">
      <div class="call-panel-head">
        <span class="t">Video Call</span>
        <span class="p" id="callParticipantCount"></span>
        <span class="spacer"></span>
        <button class="call-head-btn" id="callFullscreenBtn" onclick="toggleCallFullscreen()" title="Fullscreen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
      
      <div class="call-panel-body">
        <div id="remoteVideos"></div>
        
        <!-- Local self Video PIP -->
        <div id="callLocalWrap">
          <div class="video-placeholder">
            <div class="v-avatar" id="localAvatar">ME</div>
            <div class="v-status">Camera Off</div>
          </div>
          <video id="localVideo" autoplay muted playsinline></video>
        </div>
        
        <div id="callStatus"></div>
      </div>
      
      <!-- Video controls bar -->
      <div class="call-controls">
        <button id="btnMute" onclick="toggleMute()" title="Mute microphone">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        <button id="btnCam" onclick="toggleCam()" title="Turn camera off">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
        </button>
        <button class="danger" onclick="leaveCall()" title="Leave call">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.59 3.4Z"/></svg>
        </button>
      </div>
      
      <!-- Floating action buttons on video overlay on mobile -->
      <button id="floatingChatBtn" onclick="changeCallLayout('chat')" title="Open Chat Panel">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
    </div>
    
    <button id="floatingVideoBtn" onclick="changeCallLayout('video')" title="Back to Video Panel">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
    </button>
  </div>
</div>

<input type="file" id="fileInput" multiple style="display:none" onchange="onFilesSelected()">

<script>
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var key=null, salt=null, clientId=null, token=null, myName=null, ws=null;
var heartbeatTimer=null, reconnectTimer=null, joining=false;
var members=new Map();
var filesCache=new Map();
var pendingFiles=[];
var pcList={}, localStream=null, callMembers={}, inCall=false, callActive=false, micMuted=false, camOff=false, pinnedId=null;

// Responsive & Layout Settings
var mobileCallLayout = 'split'; 
var rosterOpen = false;

function b64(u8){var c=new Uint8Array(u8),s='';for(var i=0;i<c.length;i+=0x8000){s+=String.fromCharCode.apply(null,c.subarray(i,i+0x8000));}return btoa(s);}
function fromB64(s){var bin=atob(s),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++){u[i]=bin.charCodeAt(i);}return u;}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtSize(b){if(b<1024){return b+' B';}if(b<1048576){return (b/1024).toFixed(1)+' KB';}if(b<1073741824){return (b/1048576).toFixed(1)+' MB';}return (b/1073741824).toFixed(2)+' GB';}
function fmtTime(t){var d=new Date(t*1000);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function scrollBottom(){var el=$('messages');if(el){el.scrollTop=el.scrollHeight;}}

// Avatar Initials & Gradient Generator
function getAvatarGradient(name) {
  var colors = [
    ['#3b82f6', '#1d4ed8'], // Blue
    ['#10b981', '#047857'], // Green
    ['#8b5cf6', '#6d28d9'], // Violet
    ['#ec4899', '#be185d'], // Pink
    ['#f59e0b', '#b45309'], // Yellow/Amber
    ['#ef4444', '#b91c1c'], // Red
    ['#06b6d4', '#0891b2'], // Cyan
    ['#14b8a6', '#0f766e'], // Teal
    ['#f97316', '#c2410c']  // Orange
  ];
  var sum = 0;
  var str = name || '';
  for (var i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  var idx = sum % colors.length;
  return 'linear-gradient(135deg, ' + colors[idx][0] + ', ' + colors[idx][1] + ')';
}

function getInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function deriveKey(password){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']).then(function(km){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:fromB64(salt),iterations:310000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  });
}
function encText(t){var n=crypto.getRandomValues(new Uint8Array(12));return crypto.subtle.encrypt({name:'AES-GCM',iv:n},key,new TextEncoder().encode(t)).then(function(ct){return{n:b64(n),c:b64(ct)};});}
function decText(n,c){return crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(n)},key,fromB64(c)).then(function(pt){return new TextDecoder().decode(pt);});}
function encBytes(data){var n=crypto.getRandomValues(new Uint8Array(12));return crypto.subtle.encrypt({name:'AES-GCM',iv:n},key,data).then(function(ct){return{n:b64(n),c:new Uint8Array(ct)};});}
function decBytes(n,c){return crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(n)},key,c);}

function showError(t){var e=$('gateError');e.textContent=t;e.style.display='block';}
function hideError(){$('gateError').style.display='none';}

function join(){
  if(joining){return;}
  var password=$('password').value;
  var name=$('name').value.trim();
  if(!password){showError('Enter the room password');return;}
  if(!name){showError('Enter your display name');return;}
  joining=true;$('joinBtn').disabled=true;hideError();
  fetch('/api/chat/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password,name:name})})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(data){return{ok:r.ok,data:data};});})
    .then(function(res){
      if(!res.ok){throw new Error(res.data.error||'Failed to join room');}
      salt=res.data.salt;token=res.data.send_token;clientId=res.data.client_id;myName=name;
      return deriveKey(password).then(function(k){key=k;return res.data.members||[];});
    })
    .then(function(list){
      members=new Map(list.map(function(m){return[m.id,m.name];}));
      renderRoster();
      $('gate').style.display='none';
      $('chat').style.display='flex';
      connectWS();
      requestWakeLock();
    })
    .catch(function(e){
      showError(e.message||'Failed to join');
      joining=false;$('joinBtn').disabled=false;
    });
}

function connectWS(){
  var proto=location.protocol==='https:'?'wss://':'ws://';
  var socket=new WebSocket(proto+location.host+'/api/chat/ws?token='+encodeURIComponent(token));
  ws=socket;
  socket.onopen=function(){
    heartbeatTimer=setInterval(function(){if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'pong'}));}},25000);
  };
  socket.onmessage=function(ev){
    var m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.type==='welcome'){
      var isReconnect = $('chat').style.display === 'flex';
      if(m.client_id){clientId=m.client_id;}
      if(Array.isArray(m.members)){members=new Map(m.members.map(function(x){return[x.id,x.name];}));renderRoster();}
      if(Array.isArray(m.call_members)){handleCallState(m.call_members);}
      if(isReconnect) {
        systemNotice('Connection restored');
      } else {
        systemNotice('You joined as '+esc(myName));
      }
      updateCallButton();
    }else if(m.type==='member'&&m.member){
      if(m.action==='join'){
        var isNew = !members.has(m.member.id);
        members.set(m.member.id,m.member.name);
        if(isNew){systemNotice(esc(m.member.name)+' joined');}
      }
      else if(m.action==='leave'){members.delete(m.member.id);systemNotice(esc(m.member.name)+' left');}
      renderRoster();
    }else if(m.type==='msg'&&m.message){
      handleMessage(m.message);
    }else if(m.type==='signal'&&m.signal){
      handleSignal(m.client_id,m.name,m.signal);
    }else if(m.type==='call-state'&&Array.isArray(m.call_members)){
      handleCallState(m.call_members);
    }else if(m.type==='ping'){
      if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'pong'}));}
    }else if(m.type==='error'){
      systemNotice('Error: '+esc(m.text||''));
    }
  };
  socket.onclose=function(){
    clearInterval(heartbeatTimer);
    if(inCall){teardownCall();}
    if(!socket.manualClose){
      systemNotice('Connection lost — reconnecting...');
      scheduleReconnect();
    }
  };
  socket.onerror=function(){try{socket.close();}catch(e){} };
}

function scheduleReconnect(){
  clearTimeout(reconnectTimer);
  reconnectTimer=setTimeout(function(){connectWS();},1500);
}

var wakeLock = null;
function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  navigator.wakeLock.request('screen')
    .then(function(lock) {
      wakeLock = lock;
      console.log('Screen Wake Lock active');
    })
    .catch(function(err) {
      console.warn('Wake Lock request failed:', err);
    });
}
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release()
      .then(function() {
        wakeLock = null;
        console.log('Screen Wake Lock released');
      })
      .catch(function(err) {
        console.error('Wake Lock release failed:', err);
      });
  }
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && token) {
    requestWakeLock();
  }
});

function leave(){
  releaseWakeLock();
  if(ws){ws.manualClose=true;try{ws.close();}catch(e){}}
  clearInterval(heartbeatTimer);clearTimeout(reconnectTimer);
  location.reload();
}

function handleMessage(m){
  var own=m.from&&m.from.id===clientId;
  if(m.kind==='text'){
    decText(m.nonce,m.ciphertext)
      .then(function(text){renderText(own,m.from.name,text,m.ts);})
      .catch(function(){renderText(own,m.from.name,'[unable to decrypt]',m.ts);});
  }else if(m.kind==='image'){
    var wrap=renderFileCard(own,m.from.name,m,'Downloading image...');
    downloadFile(m,wrap,true);
  }else if(m.kind==='file'){
    var wrap=renderFileCard(own,m.from.name,m,'Download');
    downloadFile(m,wrap,false);
  }
}

function renderText(own,sender,text,ts){
  var el=document.createElement('div');
  el.className='msg '+(own?'own':'other');
  var avatarGrad = getAvatarGradient(sender);
  var initials = getInitials(sender);
  
  var bubbleContent = '';
  var trimmed = text.trim();
  var isGifUrl = false;
  if (trimmed.match(/^https?:\/\/[^\s]+$/i)) {
    if (trimmed.match(/\.(gif|png|jpe?g|webp)(\?.*)?$/i) || 
        trimmed.match(/^https?:\/\/[a-zA-Z0-9.-]+\.giphy\.com\//i) || 
        trimmed.startsWith('https://media.giphy.com/')) {
      isGifUrl = true;
    }
  }
  
  if (isGifUrl) {
    bubbleContent = '<div class="bubble gif-bubble"><img src="' + esc(trimmed) + '" alt="gif" referrerpolicy="no-referrer"></div>';
  } else {
    var gifMatch = text.match(/^\[gif:(.*)\]$/);
    if (gifMatch) {
      var gifUrl = gifMatch[1];
      bubbleContent = '<div class="bubble gif-bubble"><img src="' + esc(gifUrl) + '" alt="gif" referrerpolicy="no-referrer"></div>';
    } else {
      bubbleContent = '<div class="bubble">' + esc(text) + '</div>';
    }
  }
  
  el.innerHTML=
    '<div class="msg-avatar" style="background:'+avatarGrad+'">'+esc(initials)+'</div>' +
    '<div class="msg-body">' +
      '<div class="msg-header">' +
        '<span class="msg-sender">'+esc(sender)+'</span>' +
        '<span class="msg-time">'+fmtTime(ts)+'</span>' +
      '</div>' +
      bubbleContent +
    '</div>';
  
  $('messages').appendChild(el);
  scrollBottom();
}

function renderFileCard(own,sender,m,btnLabel){
  var el=document.createElement('div');
  el.className='msg '+(own?'own':'other');
  var avatarGrad = getAvatarGradient(sender);
  var initials = getInitials(sender);
  
  var icon=m.kind==='image'||(m.mime||'').indexOf('image/')===0
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  
  el.innerHTML=
    '<div class="msg-avatar" style="background:'+avatarGrad+'">'+esc(initials)+'</div>' +
    '<div class="msg-body">' +
      '<div class="msg-header">' +
        '<span class="msg-sender">'+esc(sender)+'</span>' +
        '<span class="msg-time">'+fmtTime(m.ts)+'</span>' +
      '</div>' +
      '<div class="file-card">' +
        '<div class="fic">'+icon+'</div>' +
        '<div class="meta">' +
          '<div class="fname">'+esc(m.file_name||'file')+'</div>' +
          '<div class="fsize">'+fmtSize(m.file_size||0)+'</div>' +
        '</div>' +
        '<button class="dbtn" id="btn-'+m.id+'">'+esc(btnLabel)+'</button>' +
      '</div>' +
    '</div>';
    
  $('messages').appendChild(el);
  scrollBottom();
  return el;
}

function downloadFile(m,wrap,isImage){
  var cached=filesCache.get(m.file_id);
  if(cached&&cached.data){
    showDownloaded(m,wrap,isImage,cached.data);
    return;
  }
  var btn=wrap.querySelector('.dbtn');
  if(btn){btn.textContent='Downloading...';btn.classList.add('loading');}
  fetch('/api/chat/files/'+encodeURIComponent(m.file_id),{headers:{'X-Chat-Token':token}})
    .then(function(resp){
      if(!resp.ok){throw new Error('Download failed');}
      return resp.arrayBuffer();
    })
    .then(function(buf){
      return decBytes(m.nonce,new Uint8Array(buf));
    })
    .then(function(data){
      filesCache.set(m.file_id,{data:data});
      showDownloaded(m,wrap,isImage,data);
    })
    .catch(function(e){
      var btn2=wrap.querySelector('.dbtn');
      if(btn2){btn2.textContent='Failed — retry';btn2.classList.remove('loading');btn2.onclick=function(){downloadFile(m,wrap,isImage);};}
    });
}

// Shows downloaded files
function showDownloaded(m,wrap,isImage,data){
  var btn=wrap.querySelector('.dbtn');if(btn){btn.remove();}
  if(isImage){
    var blob=new Blob([data],{type:m.mime||'image/png'});
    var url=URL.createObjectURL(blob);
    var w=document.createElement('div');w.className='img-wrap';
    var img=document.createElement('img');
    img.src=url;img.alt=m.file_name||'image';
    img.onclick=function(){window.open(url,'_blank');};
    w.appendChild(img);wrap.appendChild(w);
  }else{
    var url=URL.createObjectURL(new Blob([data],{type:m.mime||'application/octet-stream'}));
    var d=document.createElement('button');
    d.className='dbtn';d.textContent='Save ('+fmtSize(data.length)+')';
    d.onclick=function(){var a=document.createElement('a');a.href=url;a.download=m.file_name||'file';document.body.appendChild(a);a.click();a.remove();};
    wrap.querySelector('.file-card').appendChild(d);
  }
  scrollBottom();
}

function systemNotice(text){
  var el=document.createElement('div');
  el.className='sys-notice';el.textContent=text;
  $('messages').appendChild(el);scrollBottom();
}

function renderRoster(){
  var list=$('rosterList');list.innerHTML='';
  members.forEach(function(name,id){
    var d=document.createElement('div');d.className='member';
    var avatarGrad = getAvatarGradient(name);
    var initials = getInitials(name);
    
    var av = document.createElement('div');
    av.className = 'm-avatar';
    av.style.background = avatarGrad;
    av.textContent = initials;
    
    var dot = document.createElement('span');
    dot.className = 'm-status-dot';
    av.appendChild(dot);
    
    var n=document.createElement('span');n.className='name';n.textContent=name;
    
    d.appendChild(av);
    d.appendChild(n);
    list.appendChild(d);
  });
  var c=members.size;
  $('memberCount').textContent=c+' member'+(c===1?'':'s')+' online';
  $('rosterTitle').textContent='Members ('+c+')';
}

function send(){
  if(!ws||ws.readyState!==1){systemNotice('Not connected');return;}
  var input=$('input');
  var text=input.value.trim();
  var hasText=text.length>0;
  if(!hasText&&pendingFiles.length===0){return;}
  if(hasText){
    encText(text).then(function(enc){
      ws.send(JSON.stringify({type:'msg',kind:'text',nonce:enc.n,ciphertext:enc.c}));
    });
    input.value='';input.style.height='40px';input.style.overflowY='hidden';
  }
  var sending=[].concat(pendingFiles);
  pendingFiles=[];
  renderPending();
  sending.forEach(function(f){sendFile(f);});
  input.focus();
}

function sendFile(f){
  if(!ws||ws.readyState!==1){systemNotice('Not connected');return;}
  var nonce=null;
  f.file.arrayBuffer()
    .then(function(buf){return encBytes(new Uint8Array(buf));})
    .then(function(enc){
      nonce=enc.n;
      return fetch('/api/chat/files',{
        method:'POST',
        headers:{
          'X-Chat-Token':token,
          'X-Chat-Filename':encodeURIComponent(f.file.name),
          'X-Chat-FileSize':String(f.file.size),
          'X-Chat-Mime':f.file.type||'application/octet-stream'
        },
        body:enc.c
      });
    })
    .then(function(resp){
      if(!resp.ok){throw new Error('Upload failed');}
      return resp.json();
    })
    .then(function(data){
      var isImage=(f.file.type||'').indexOf('image/')===0;
      ws.send(JSON.stringify({
        type:'msg',
        kind:isImage?'image':'file',
        nonce:nonce,
        file_id:data.file_id,
        file_name:f.file.name,
        file_size:f.file.size,
        mime:f.file.type||'application/octet-stream'
      }));
    })
    .catch(function(e){systemNotice('Failed to send '+esc(f.file.name)+': '+esc(e.message||'error'));});
}

function onFilesSelected(){
  var input=$('fileInput');
  if(input.files.length){
    for(var i=0;i<input.files.length;i++){addPendingFile(input.files[i]);}
    renderPending();
  }
  input.value='';
}

function addPendingFile(file){
  if(file.size>52428800){systemNotice('Skipped '+esc(file.name)+' — max size is 50 MB');return;}
  pendingFiles.push({file:file});
}

function renderPending(){
  var box=$('pending');box.innerHTML='';
  pendingFiles.forEach(function(p,i){
    var chip=document.createElement('span');chip.className='pchip';
    chip.appendChild(document.createTextNode(p.file.name));
    var x=document.createElement('span');x.className='x';x.textContent='✕';
    x.onclick=function(){pendingFiles.splice(i,1);renderPending();};
    chip.appendChild(x);box.appendChild(chip);
  });
}

function attachFiles(fileList){
  for(var i=0;i<fileList.length;i++){addPendingFile(fileList[i]);}
  if(pendingFiles.length){renderPending();}
}

// ── Room-wide video call (WebRTC mesh) ──
function wsSendSignal(to,signal){
  if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'signal',to:to,signal:signal}));}
}

function callMsg(action){
  if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'call',action:action}));}
}

function startMedia(){
  if(localStream){return Promise.resolve(localStream);}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){return Promise.reject(new Error('Camera/microphone are not available in this browser'));}
  return navigator.mediaDevices.getUserMedia({video:true,audio:true});
}

function onVideoCallBtn(){
  if(inCall){leaveCall();}
  else if(callActive){joinCall();}
  else{startCall();}
}

function updateCallButton(){
  var btn=$('videoCallBtn'), lbl=$('videoCallLabel');
  if(!btn){return;}
  if(inCall){
    lbl.textContent='Leave Call';
    btn.title='Leave the video call';
  } else if(callActive){
    lbl.textContent='Join Call';
    btn.title='Join the room video call';
  } else {
    lbl.textContent='Start Call';
    btn.title='Start a video call the whole room can join';
  }
}

// Toggle layout modes when in WebRTC call (for Mobile / Tablet)
function changeCallLayout(mode) {
  mobileCallLayout = mode;
  var chatEl = $('chat');
  chatEl.classList.remove('layout-split', 'layout-video', 'layout-chat');
  chatEl.classList.add('layout-' + mode);
  
  // Set tab buttons active state
  $('tabSplit').classList.toggle('active', mode === 'split');
  $('tabVideo').classList.toggle('active', mode === 'video');
  $('tabChat').classList.toggle('active', mode === 'chat');
  
  setTimeout(scrollBottom, 120);
}

// Roster drawer toggle
function toggleRoster(){
  var isMobile = window.innerWidth < 1024;
  if (isMobile) {
    rosterOpen = !rosterOpen;
    var roster = $('rosterDrawer');
    var backdrop = $('rosterBackdrop');
    if (roster && backdrop) {
      if (rosterOpen) {
        roster.classList.add('active');
        backdrop.classList.add('active');
      } else {
        roster.classList.remove('active');
        backdrop.classList.remove('active');
      }
    }
  } else {
    // Desktop layout hides/shows roster
    var chatEl = $('chat');
    chatEl.classList.toggle('roster-hidden');
  }
}

function startCall(){
  if(inCall){return;}
  hideJoinBar();
  startMedia().then(function(stream){
    localStream=stream;
    inCall=true;callActive=true;
    $('localVideo').srcObject=stream;
    $('chat').classList.add('in-call');
    
    // Set default view layout
    changeCallLayout('split');
    $('localAvatar').textContent = getInitials(myName);
    $('localAvatar').style.background = getAvatarGradient(myName);
    $('callLocalWrap').classList.remove('cam-muted');
    
    $('callPanel').classList.add('active');
    $('callStatus').textContent='Waiting for others to join...';
    $('callStatus').style.display='block';
    updateParticipantCount();
    updateCallButton();
    callMsg('join');
    systemNotice('Video call started — anyone in the room can join');
  }).catch(function(e){
    systemNotice('Could not start video call: '+esc(e.message||'error'));
  });
}

function joinCall(){
  if(inCall){return;}
  hideJoinBar();
  startMedia().then(function(stream){
    localStream=stream;
    inCall=true;callActive=true;
    $('localVideo').srcObject=stream;
    $('chat').classList.add('in-call');
    
    // Set default view layout
    changeCallLayout('split');
    $('localAvatar').textContent = getInitials(myName);
    $('localAvatar').style.background = getAvatarGradient(myName);
    $('callLocalWrap').classList.remove('cam-muted');
    
    $('callPanel').classList.add('active');
    $('callStatus').textContent='Connecting...';
    $('callStatus').style.display='block';
    updateParticipantCount();
    updateCallButton();
    callMsg('join');
    systemNotice('You joined the video call');
  }).catch(function(e){
    systemNotice('Could not join video call: '+esc(e.message||'error'));
  });
}

function leaveCall(){
  if(!inCall){return;}
  callMsg('leave');
  teardownCall();
  updateCallButton();
}

function teardownCall(){
  inCall=false;
  pinnedId=null;
  Object.keys(pcList).forEach(function(id){closePeer(id);});
  if(localStream){localStream.getTracks().forEach(function(t){try{t.stop();}catch(e){}});}
  localStream=null;
  if(document.fullscreenElement){document.exitFullscreen();}
  $('chat').classList.remove('in-call', 'layout-split', 'layout-video', 'layout-chat');
  $('callPanel').classList.remove('active');
  $('localVideo').srcObject=null;
  $('callStatus').style.display='none';
  micMuted=false;camOff=false;
  
  // Re-enable mute/cam controls states
  $('btnMute').classList.remove('off');
  $('btnMute').title='Mute microphone';
  $('btnCam').classList.remove('off');
  $('btnCam').title='Turn camera off';
}

function handleCallState(memberList){
  var next={};
  memberList.forEach(function(x){next[x.id]=x.name;});
  callMembers=next;
  callActive=Object.keys(callMembers).length>0;
  if(!callActive){
    hideJoinBar();
    if(inCall){teardownCall();}
  }else if(inCall){
    hideJoinBar();
    Object.keys(callMembers).forEach(function(id){
      if(id===clientId)return;
      if(!pcList[id]){syncPeer(id,callMembers[id]);}
    });
    Object.keys(pcList).forEach(function(id){
      if(!callMembers[id]){closePeer(id);}
    });
  }else{
    showJoinBar();
  }
  updateCallButton();
  updateParticipantCount();
}

function showJoinBar(){
  var names=Object.keys(callMembers).map(function(id){return callMembers[id];});
  var text=names.length===1?(names[0]+' started a video call'):('A video call is in progress — '+names.length+' participants');
  $('joinBarText').textContent=text;
  $('joinBar').style.display='flex';
}

function hideJoinBar(){$('joinBar').style.display='none';}

function syncPeer(id,name){
  if(id===clientId||pcList[id])return;
  if(clientId<id){createOfferTo(id,name);}
}

function createPeer(id,name){
  var p=new RTCPeerConnection();
  localStream.getTracks().forEach(function(t){p.addTrack(t,localStream);});
  
  var avatarGrad = getAvatarGradient(name);
  var initials = getInitials(name);
  
  var cell=document.createElement('div');
  cell.className='remote-cell';
  cell.id='rcell-'+id;
  cell.innerHTML=
    '<div class="video-placeholder">' +
      '<div class="v-avatar" style="background:'+avatarGrad+'">'+esc(initials)+'</div>' +
      '<div class="v-status">Camera Off</div>' +
    '</div>' +
    '<button class="pin-btn" id="pinbtn-'+id+'" title="Pin video"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg></button>' +
    '<div class="remote-name">'+esc(name)+'</div>' +
    '<video id="rvideo-'+id+'" autoplay playsinline></video>';
    
  $('remoteVideos').appendChild(cell);
  var pb=$('pinbtn-'+id);
  pb.onclick=function(ev){ev.stopPropagation();togglePin(id);};
  p.onicecandidate=function(ev){
    if(ev.candidate){wsSendSignal(id,{kind:'ice',candidate:ev.candidate});}
  };
  p.ontrack=function(ev){
    var v=$('rvideo-'+id);
    if(v&&ev.streams&&ev.streams[0]){v.srcObject=ev.streams[0];}
    $('callStatus').style.display='none';
    
    // Monitor camera off/track mute event
    ev.track.onmute = function() {
      if(ev.track.kind === 'video') {
        var c = $('rcell-'+id);
        if(c) c.classList.add('cam-muted');
      }
    };
    ev.track.onunmute = function() {
      if(ev.track.kind === 'video') {
        var c = $('rcell-'+id);
        if(c) c.classList.remove('cam-muted');
      }
    };
    
    if(ev.track.kind === 'video' && ev.track.muted) {
      var c = $('rcell-'+id);
      if(c) c.classList.add('cam-muted');
    }
  };
  p.onconnectionstatechange=function(){
    if(p.connectionState==='disconnected'||p.connectionState==='failed'||p.connectionState==='closed'){
      closePeer(id);
    }
  };
  pcList[id]={pc:p,name:name};
  updateParticipantCount();
  return pcList[id];
}

function togglePin(id){
  if(pinnedId===id){unpin(id);return;}
  if(pinnedId){unpin(pinnedId);}
  pinnedId=id;
  var c=$('rcell-'+id);if(c){c.classList.add('featured');}
  var b=$('pinbtn-'+id);if(b){b.classList.add('pinned');b.title='Unpin video';}
}

function unpin(id){
  if(pinnedId===id){pinnedId=null;}
  var c=$('rcell-'+id);if(c){c.classList.remove('featured');}
  var b=$('pinbtn-'+id);if(b){b.classList.remove('pinned');b.title='Pin video';}
}

function toggleCallFullscreen(){
  var el=$('callPanel');
  if(document.fullscreenElement){document.exitFullscreen();}
  else if(el.requestFullscreen){el.requestFullscreen().catch(function(){});}
}

function setFullscreenBtn(active){
  var b=$('callFullscreenBtn');
  if(!b){return;}
  b.innerHTML=active
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  b.title=active?'Exit fullscreen':'Fullscreen';
}

document.addEventListener('fullscreenchange',function(){setFullscreenBtn(!!document.fullscreenElement);});

function closePeer(id){
  var p=pcList[id];
  if(p){try{p.pc.close();}catch(e){}}
  delete pcList[id];
  if(pinnedId===id){unpin(id);}
  var c=$('rcell-'+id);if(c){c.remove();}
  updateParticipantCount();
}

function createOfferTo(id,name){
  if(pcList[id])return;
  var p=createPeer(id,name);
  p.pc.createOffer().then(function(o){
    return p.pc.setLocalDescription(o);
  }).then(function(){
    wsSendSignal(id,{kind:'offer',offer:p.pc.localDescription});
  }).catch(function(){closePeer(id);});
}

function handleSignal(fromId,fromName,s){
  if(!s||!s.kind)return;
  var kind=s.kind;
  if(kind==='offer'){
    if(!inCall||pcList[fromId])return;
    var p=createPeer(fromId,fromName);
    p.pc.setRemoteDescription(s.offer).then(function(){
      return p.pc.createAnswer();
    }).then(function(ans){
      return p.pc.setLocalDescription(ans);
    }).then(function(){
      wsSendSignal(fromId,{kind:'answer',answer:p.pc.localDescription});
    }).catch(function(){closePeer(fromId);});
  }else if(kind==='answer'){
    if(pcList[fromId]&&pcList[fromId].pc){
      pcList[fromId].pc.setRemoteDescription(s.answer).catch(function(){closePeer(fromId);});
    }
  }else if(kind==='ice'){
    if(pcList[fromId]&&pcList[fromId].pc){
      pcList[fromId].pc.addIceCandidate(s.candidate).catch(function(){});
    }
  }
}

function updateVideoLayout() {
  var grid = $('remoteVideos');
  if (!grid) return;
  var cells = grid.querySelectorAll('.remote-cell');
  var count = cells.length;
  for (var i = 0; i <= 12; i++) {
    grid.classList.remove('count-' + i);
  }
  grid.classList.add('count-' + count);
}

function updateParticipantCount(){
  var el=$('callParticipantCount');
  if(!el){return;}
  var n=Object.keys(pcList).length+(inCall?1:0);
  el.textContent=n>0?(n+' participant'+(n===1?'':'s')):'';
  if(inCall){
    if(Object.keys(pcList).length===0){
      $('callStatus').textContent='Waiting for others to join...';
      $('callStatus').style.display='block';
    }else{
      $('callStatus').style.display='none';
    }
  }
  updateVideoLayout();
}

function toggleMute(){
  if(!localStream){return;}
  micMuted=!micMuted;
  localStream.getAudioTracks().forEach(function(t){t.enabled=!micMuted;});
  $('btnMute').classList.toggle('off',micMuted);
  $('btnMute').title=micMuted?'Unmute microphone':'Mute microphone';
}

function toggleCam(){
  if(!localStream){return;}
  camOff=!camOff;
  localStream.getVideoTracks().forEach(function(t){t.enabled=!camOff;});
  $('btnCam').classList.toggle('off',camOff);
  $('btnCam').title=camOff?'Turn camera on':'Turn camera off';
  
  $('callLocalWrap').classList.toggle('cam-muted', camOff);
}

// Drag & Drop File Sharing Panel
var dragTimer = null;
document.addEventListener('dragover', function(e){
  e.preventDefault();
  $('dragOverlay').classList.add('active');
  clearTimeout(dragTimer);
});
document.addEventListener('dragleave', function(e){
  e.preventDefault();
  dragTimer = setTimeout(function(){
    $('dragOverlay').classList.remove('active');
  }, 100);
});
document.addEventListener('drop', function(e){
  e.preventDefault();
  $('dragOverlay').classList.remove('active');
  if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){attachFiles(e.dataTransfer.files);}
});

document.addEventListener('paste',function(e){
  var items=(e.clipboardData&&e.clipboardData.items)||[];
  var found=false;
  for(var i=0;i<items.length;i++){
    if(items[i].kind==='file'){
      var f=items[i].getAsFile();
      if(f){addPendingFile(f);found=true;}
    }
  }
  if(found){renderPending();}
});

$('input').addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
});
$('input').addEventListener('input',function(e){
  e.target.style.height='40px';
  var scrollH = e.target.scrollHeight;
  e.target.style.height=Math.min(scrollH,120)+'px';
  if(scrollH > 120) {
    e.target.style.overflowY='auto';
  } else {
    e.target.style.overflowY='hidden';
  }
});
$('password').addEventListener('keydown',function(e){if(e.key==='Enter'){join();}});
$('name').addEventListener('keydown',function(e){if(e.key==='Enter'){join();}});

window.join=join;
window.send=send;
window.leave=leave;
window.onFilesSelected=onFilesSelected;
window.onVideoCallBtn=onVideoCallBtn;
window.startCall=startCall;
window.joinCall=joinCall;
window.leaveCall=leaveCall;
window.toggleMute=toggleMute;
window.toggleCam=toggleCam;
window.toggleCallFullscreen=toggleCallFullscreen;
window.changeCallLayout=changeCallLayout;
window.toggleRoster=toggleRoster;

$('password').focus();
})();
</script>
</body>
</html>"####;
