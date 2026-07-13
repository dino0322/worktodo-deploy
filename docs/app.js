const CONFIG = window.WORKTODO_CONFIG || {};
const HAS_SUPABASE = Boolean(
  CONFIG.supabaseUrl &&
  CONFIG.supabaseAnonKey &&
  window.supabase?.createClient
);

const supabaseClient = HAS_SUPABASE
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
  : null;

const STORE_KEY = "worktodoDemoV7";
const THEME_KEY = "worktodoTheme";
const STATUS_LABEL = {
  todo: "할 일",
  in_progress: "진행 중",
  review: "검토",
  done: "완료"
};
const PRIORITY_LABEL = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급"
};
const ROLE_LABEL = {
  super_admin: "전체 관리자",
  admin: "팀장",
  member: "팀원",
  manager: "매니저",
  viewer: "읽기",
  guest: "게스트"
};
const MEMBER_STATUS_LABEL = {
  active: "근무중",
  invited: "초대중",
  leave: "휴직",
  remote: "자택",
  disabled: "비활성"
};
const ROLE_META = {
  super_admin: { icon: "◆", className: "super-admin", label: "전체 관리자" },
  admin: { icon: "◆", className: "admin", label: "팀장" },
  manager: { icon: "●", className: "manager", label: "매니저" },
  member: { icon: "■", className: "member", label: "팀원" },
  viewer: { icon: "▲", className: "viewer", label: "읽기" },
  guest: { icon: "○", className: "guest", label: "게스트" }
};
const DEMO_ACCOUNT_HINTS = [
  { role: "super_admin", email: "admin@worktodo.local", password: "admin123", name: "전체관리자" },
  { role: "admin", email: "lead@worktodo.local", password: "lead123", name: "팀장 계정" },
  { role: "manager", email: "manager@worktodo.local", password: "manager123", name: "매니저 계정" },
  { role: "member", email: "member@worktodo.local", password: "member123", name: "팀원 계정" },
  { role: "guest", email: "guest@worktodo.local", password: "guest123", name: "게스트 계정" }
];

let state = {
  mode: HAS_SUPABASE ? "live" : "demo",
  user: null,
  workspace: null,
  workspaces: [],
  allWorkspaces: [],
  allMemberships: [],
  allTasks: [],
  role: "member",
  profiles: [],
  members: [],
  invites: [],
  projects: [],
  tasks: [],
  comments: [],
  notices: [],
  questions: [],
  messages: [],
  activeNoticeId: null,
  activeTaskId: null,
  activeMessageId: null,
  activeMemberId: null,
  activeMessageTargetId: null,
  editingTaskId: null,
  editingNoticeId: null,
  creatingWorkspaceFromMenu: false,
  memberMenu: null,
  activeForm: null,
  profileOpen: false,
  profileEditOpen: false,
  workspaceMenuOpen: false,
  adminWorkspaceId: null,
  noWorkspace: false,
  messageScope: "team",
  taskScope: "mine",
  theme: localStorage.getItem(THEME_KEY) || "light",
  view: "home",
  filters: {
    search: "",
    noticeSearch: "",
    noticePage: 1,
    status: "all",
    assignee: "all",
    priority: "all"
  }
};

const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");
const DRAFT_PREFIX = "worktodoDraft:";

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function applyTheme() {
  document.body.dataset.theme = state.theme === "dark" ? "dark" : "light";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, state.theme);
  applyTheme();
  render();
}

function draftKey(kind) {
  return `${DRAFT_PREFIX}${state.user?.id || "guest"}:${state.workspace?.id || "workspace"}:${kind}`;
}

function loadDraft(kind) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(kind)) || "{}");
  } catch {
    return {};
  }
}

function saveDraft(kind, form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll("input[type='checkbox']").forEach((input) => {
    data[input.name] = input.checked ? "on" : "";
  });
  localStorage.setItem(draftKey(kind), JSON.stringify(data));
}

function clearDraft(kind) {
  localStorage.removeItem(draftKey(kind));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isOverdue(task) {
  return task.due_date && task.status !== "done" && task.due_date < today();
}

function currentProfile() {
  return state.profiles.find((profile) => profile.id === state.user?.id) || {
    id: state.user?.id,
    email: state.user?.email,
    full_name: state.user?.name || state.user?.email || "사용자",
    avatar_url: ""
  };
}

function profileName(id) {
  const profile = state.profiles.find((item) => item.id === id);
  return profile?.full_name || profile?.email || "미지정";
}

function profileById(id) {
  return state.profiles.find((item) => item.id === id);
}

function noticeExcerpt(body = "", length = 86) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function initials(name = "") {
  const compact = String(name || "사용자").replace(/\s+/g, "");
  return compact.slice(0, 2).toUpperCase();
}

function avatarStyle(seed = "") {
  const palette = [
    ["#2563eb", "#0f766e"],
    ["#7c3aed", "#db2777"],
    ["#0891b2", "#4f46e5"],
    ["#ea580c", "#be123c"],
    ["#16a34a", "#0284c7"],
    ["#9333ea", "#ca8a04"],
    ["#0f766e", "#65a30d"],
    ["#475569", "#2563eb"]
  ];
  const key = String(seed || "user").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [from, to] = palette[key % palette.length];
  return `--avatar-from:${from}; --avatar-to:${to};`;
}

function renderAvatar(userId, size = "", fallbackLabel = "") {
  const profile = profileById(userId);
  const label = fallbackLabel || profile?.full_name || profile?.email || "사용자";
  const classes = ["person-avatar", size].filter(Boolean).join(" ");
  const image = profile?.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">`
    : escapeHtml(initials(label));
  return `<span class="${classes}" style="${avatarStyle(userId || label)}">${image}</span>`;
}

function renderAvatarWithRole(userId, size = "", fallbackLabel = "") {
  const role = memberRole(userId);
  return `
    <span class="avatar-with-role">
      ${renderAvatar(userId, size, fallbackLabel)}
      <span class="avatar-role-badge">${roleBadge(role, false, true)}</span>
    </span>
  `;
}

function renderTeamAvatar(size = "") {
  return `<span class="person-avatar team ${size}" style="${avatarStyle(state.workspace?.id || "team")}">팀</span>`;
}

function messageThread(message) {
  return messageItems(message).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

function messageItems(message) {
  return [
    {
      id: `${message.id}-root`,
      message_id: message.id,
      author_id: message.sender_id,
      body: message.body,
      created_at: message.created_at,
      read_by: message.read_by || []
    },
    ...(message.replies || []).map((reply) => ({
      ...reply,
      message_id: message.id,
      read_by: message.read_by || []
    }))
  ];
}

function conversationThread(conversation) {
  return (conversation.messages || [conversation])
    .flatMap(messageItems)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

function latestMessage(conversation) {
  const thread = conversationThread(conversation);
  return thread[thread.length - 1] || null;
}

function unreadMessages(conversation) {
  return (conversation.messages || [conversation]).filter(messageIsUnread);
}

function unreadMessageLabel(conversation) {
  const count = unreadMessages(conversation).length;
  if (!count) return "";
  return count >= 4 ? "4+" : String(count);
}

function messageIsUnread(message) {
  const latest = latestMessage({ messages: [message] });
  if (!latest || latest.author_id === state.user?.id) return false;
  return !(message.read_by || []).includes(state.user?.id);
}

function messagePeerId(message) {
  if (message.recipient_id === state.user?.id) return message.sender_id;
  if (message.sender_id === state.user?.id) return message.recipient_id;
  return message.recipient_id || message.sender_id;
}

function messagePeerName(conversation) {
  if (!conversation.is_private) return "팀 메시지";
  return profileName(conversation.peer_id);
}

function sortedMessages(scope = state.messageScope) {
  const visible = visibleMessages();
  if (scope === "team") {
    const teamMessages = visible.filter((message) => !message.is_private);
    return [{
      id: `team:${state.workspace?.id || "workspace"}`,
      is_private: false,
      is_team_thread: true,
      messages: teamMessages,
      body: "팀 메시지가 아직 없습니다.",
      created_at: teamMessages[0]?.created_at || new Date().toISOString()
    }];
  }

  const grouped = new Map();
  visible.filter((message) => message.is_private).forEach((message) => {
    const peerId = messagePeerId(message);
    if (!peerId) return;
    if (!grouped.has(peerId)) {
      grouped.set(peerId, {
        id: `private:${peerId}`,
        is_private: true,
        peer_id: peerId,
        messages: []
      });
    }
    grouped.get(peerId).messages.push(message);
  });

  return Array.from(grouped.values())
    .sort((a, b) => new Date(latestMessage(b)?.created_at || 0) - new Date(latestMessage(a)?.created_at || 0));
}

function activeDemoWorkspace(data) {
  const workspaces = data.workspaces?.length ? data.workspaces : [data.workspace].filter(Boolean);
  return workspaces.find((workspace) => workspace.id === data.activeWorkspaceId) || workspaces[0];
}

function normalizeDemoData(data) {
  const fallbackWorkspace = data.workspace || { id: "demo-workspace", name: "Work To Do 팀" };
  data.workspaces = data.workspaces?.length ? data.workspaces : [fallbackWorkspace];
  data.activeWorkspaceId = data.activeWorkspaceId || data.workspaces[0]?.id || fallbackWorkspace.id;
  data.workspace = activeDemoWorkspace(data) || fallbackWorkspace;
  data.projects = data.projects || [];
  data.tasks = data.tasks || [];
  data.comments = data.comments || [];
  data.notices = data.notices || [];
  data.questions = data.questions || [];
  data.messages = (data.messages || []).map((message) => ({
    ...message,
    replies: message.replies || [],
    read_by: message.read_by || [],
    recipient_id: message.recipient_id || null
  }));
  data.invites = data.invites || [];
  return data;
}

function readDemo() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      return normalizeDemoData(JSON.parse(raw));
    } catch {
      localStorage.removeItem(STORE_KEY);
    }
  }
  const adminId = "demo-admin";
  const minjiId = "demo-minji";
  const hyunId = "demo-hyun";
  const managerId = "demo-manager";
  const guestId = "demo-guest";
  const workspaceId = "demo-workspace";
  const opsWorkspaceId = "demo-ops-workspace";
  const researchWorkspaceId = "demo-research-workspace";
  const projectOps = "project-ops";
  const projectLaunch = "project-launch";
  return normalizeDemoData({
    sessionUserId: adminId,
    users: [
      { id: adminId, email: "admin@worktodo.local", password: "admin123", full_name: "전체관리자", position: "서비스 관리자", avatar_url: "" },
      { id: hyunId, email: "lead@worktodo.local", password: "lead123", full_name: "이현우", position: "기획 팀장", avatar_url: "" },
      { id: managerId, email: "manager@worktodo.local", password: "manager123", full_name: "서지윤", position: "프로젝트 매니저", avatar_url: "" },
      { id: minjiId, email: "member@worktodo.local", password: "member123", full_name: "강민지", position: "운영 담당", avatar_url: "" },
      { id: guestId, email: "guest@worktodo.local", password: "guest123", full_name: "박준호", position: "외부 게스트", avatar_url: "" }
    ],
    activeWorkspaceId: workspaceId,
    workspaces: [
      { id: workspaceId, name: "Work To Do 제품팀", invite_code: "WTD-2026" },
      { id: opsWorkspaceId, name: "운영 체크팀", invite_code: "OPS-2026" },
      { id: researchWorkspaceId, name: "리서치 랩", invite_code: "LAB-2026" }
    ],
    workspace: { id: workspaceId, name: "Work To Do 제품팀", invite_code: "WTD-2026" },
    members: [
      { workspace_id: workspaceId, user_id: adminId, role: "super_admin", status: "active" },
      { workspace_id: workspaceId, user_id: minjiId, role: "member", status: "remote" },
      { workspace_id: workspaceId, user_id: hyunId, role: "admin", status: "leave" },
      { workspace_id: workspaceId, user_id: managerId, role: "manager", status: "active" },
      { workspace_id: workspaceId, user_id: guestId, role: "guest", status: "active" },
      { workspace_id: opsWorkspaceId, user_id: adminId, role: "super_admin", status: "active" },
      { workspace_id: opsWorkspaceId, user_id: minjiId, role: "member", status: "active" },
      { workspace_id: opsWorkspaceId, user_id: hyunId, role: "member", status: "active" },
      { workspace_id: opsWorkspaceId, user_id: managerId, role: "admin", status: "active" },
      { workspace_id: researchWorkspaceId, user_id: adminId, role: "super_admin", status: "active" },
      { workspace_id: researchWorkspaceId, user_id: minjiId, role: "manager", status: "active" },
      { workspace_id: researchWorkspaceId, user_id: hyunId, role: "admin", status: "active" }
    ],
    projects: [
      { id: projectOps, workspace_id: workspaceId, name: "운영", color: "#2563eb" },
      { id: projectLaunch, workspace_id: workspaceId, name: "배포", color: "#0f766e" },
      { id: "project-ops-check", workspace_id: opsWorkspaceId, name: "체크리스트", color: "#b45309" },
      { id: "project-research", workspace_id: researchWorkspaceId, name: "실험", color: "#7c3aed" }
    ],
    tasks: [
      {
        id: uid(),
        workspace_id: opsWorkspaceId,
        project_id: "project-ops-check",
        title: "주간 운영 점검표 업데이트",
        description: "공지, 메시지, 질문 탭에서 누락된 답변이 없는지 금요일 오전에 확인한다.",
        status: "todo",
        priority: "normal",
        visibility: "team",
        creator_id: adminId,
        assignee_id: minjiId,
        due_date: today(2),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: researchWorkspaceId,
        project_id: "project-research",
        title: "업무 분류 자동화 아이디어 정리",
        description: "반복 업무와 질문 데이터를 바탕으로 자동 분류 후보를 정리한다.",
        status: "in_progress",
        priority: "low",
        visibility: "team",
        creator_id: minjiId,
        assignee_id: adminId,
        due_date: today(5),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: projectLaunch,
        title: "Supabase 프로젝트 생성",
        description: "Auth와 Postgres를 사용할 Supabase 프로젝트를 만들고 URL/Anon Key를 Netlify 환경변수에 등록한다.",
        status: "todo",
        priority: "high",
        visibility: "team",
        creator_id: adminId,
        assignee_id: adminId,
        due_date: today(1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: projectOps,
        title: "팀원 계정 초대 목록 정리",
        description: "초기 사용자 이메일과 역할을 정리한다.",
        status: "in_progress",
        priority: "normal",
        visibility: "team",
        creator_id: adminId,
        assignee_id: hyunId,
        due_date: today(3),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: projectLaunch,
        title: "Netlify 배포 체크리스트 작성",
        description: "빌드 명령, publish 폴더, 환경변수, redirect 설정을 점검한다.",
        status: "review",
        priority: "normal",
        visibility: "team",
        creator_id: hyunId,
        assignee_id: minjiId,
        due_date: today(-1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    comments: [],
    questions: [
      {
        id: uid(),
        workspace_id: workspaceId,
        author_id: minjiId,
        title: "배포 전 DB 연결은 누가 확인하나요?",
        body: "Supabase schema 실행과 GitHub Pages 배포 후 데모/DB 모드 전환 확인 담당자가 필요합니다.",
        status: "open",
        replies: [
          {
            id: uid(),
            author_id: hyunId,
            body: "제가 Supabase 쪽을 보고, 팀장님이 Pages 설정을 최종 확인하는 흐름으로 가면 좋겠습니다.",
            created_at: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString()
      }
    ],
    messages: [
      {
        id: uid(),
        workspace_id: workspaceId,
        sender_id: minjiId,
        body: "오늘 팀 업무 중 배포 체크리스트 먼저 볼게요.",
        is_private: false,
        replies: [
          { id: uid(), author_id: hyunId, body: "좋아요. 저는 Supabase 쪽 확인하겠습니다.", created_at: new Date().toISOString() },
          { id: uid(), author_id: adminId, body: "완료되면 공지에 짧게 남겨주세요.", created_at: new Date().toISOString() },
          { id: uid(), author_id: minjiId, body: "네, 끝나면 바로 공유하겠습니다.", created_at: new Date().toISOString() }
        ],
        read_by: [],
        created_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        sender_id: hyunId,
        recipient_id: adminId,
        body: "배포 권한 관련해서 팀장님과 따로 확인하고 싶습니다.",
        is_private: true,
        replies: [
          { id: uid(), author_id: adminId, body: "확인했습니다. 필요한 권한 범위만 정리해서 보내주세요.", created_at: new Date().toISOString() }
        ],
        read_by: [],
        created_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        sender_id: adminId,
        body: "오후에는 팀별 담당자만 짧게 싱크 맞추겠습니다.",
        is_private: false,
        replies: [],
        read_by: [adminId],
        created_at: new Date().toISOString()
      }
    ],
    invites: [
      {
        id: uid(),
        workspace_id: workspaceId,
        email: "new@worktodo.local",
        role: "member",
        code: "WTD-NEW",
        status: "invited",
        created_at: new Date().toISOString()
      }
    ],
    notices: [
      {
        id: uid(),
        workspace_id: workspaceId,
        author_id: adminId,
        title: "이번 주 목표",
        body: "업무 흐름은 먼저 간단하게 열고, DB 연결과 배포 안정성을 우선 확인합니다. 홈에서는 핵심 공지 제목만 짧게 보이고, 제목을 누르면 세부 일정, 담당자, 주의사항을 팝업으로 확인할 수 있습니다. 이번 주에는 GitHub Pages 배포, Supabase 스키마 점검, 팀별 권한 확인을 순서대로 마무리합니다.",
        pinned: true,
        importance: "important",
        created_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        author_id: hyunId,
        title: "질문/메시지 운영 방식",
        body: "질문은 팀 전체가 볼 수 있는 업무 Q&A로 사용하고, 메시지는 개인 상담이나 비공개 확인이 필요한 내용에 사용합니다. 매니저와 관리자는 답변 권한을 갖고, 일반 팀원에게는 답변 입력창이 보이지 않습니다.",
        pinned: false,
        importance: "normal",
        created_at: new Date().toISOString()
      },
      {
        id: uid(),
        workspace_id: opsWorkspaceId,
        author_id: adminId,
        title: "운영 체크팀 공지",
        body: "운영 체크팀에서는 매주 월요일 전체 업무 누락 여부를 확인합니다.",
        pinned: true,
        importance: "important",
        created_at: new Date().toISOString()
      }
    ]
  });
}

function writeDemo(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function makeDemoApi() {
  return {
    async session() {
      const data = readDemo();
      const user = data.users.find((item) => item.id === data.sessionUserId) || null;
      return user ? { id: user.id, email: user.email, name: user.full_name } : null;
    },
    async signIn(email, password) {
      const data = readDemo();
      const user = data.users.find((item) => item.email === email && item.password === password);
      if (!user) throw new Error("데모 계정을 찾을 수 없습니다.");
      data.sessionUserId = user.id;
      writeDemo(data);
      return { id: user.id, email: user.email, name: user.full_name };
    },
    async signUp(email, password, fullName) {
      const data = readDemo();
      if (data.users.some((item) => item.email === email)) throw new Error("이미 존재하는 이메일입니다.");
      const user = { id: uid(), email, password, full_name: fullName || email };
      data.users.push(user);
      data.sessionUserId = user.id;
      writeDemo(data);
      return { id: user.id, email: user.email, name: user.full_name };
    },
    async signOut() {
      const data = readDemo();
      data.sessionUserId = null;
      writeDemo(data);
    },
    async load() {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      const user = data.users.find((item) => item.id === data.sessionUserId);
      const member = data.members.find((item) => item.user_id === user?.id && item.workspace_id === workspace?.id);
      const workspaceMembers = data.members.filter((item) => item.workspace_id === workspace?.id && item.status !== "disabled");
      return {
        noWorkspace: !workspace || !member,
        workspace,
        workspaces: data.workspaces,
        allWorkspaces: data.workspaces,
        allMemberships: data.members.filter((item) => item.status !== "disabled"),
        allTasks: data.tasks,
        role: member?.role || "member",
        members: workspaceMembers,
        invites: (data.invites || []).filter((item) => item.workspace_id === workspace?.id),
        profiles: data.users.map(({ id, email, full_name, position, avatar_url }) => ({ id, email, full_name, position, avatar_url })),
        projects: data.projects.filter((item) => item.workspace_id === workspace?.id),
        tasks: data.tasks.filter((item) => item.workspace_id === workspace?.id),
        comments: data.comments,
        notices: data.notices.filter((item) => item.workspace_id === workspace?.id),
        questions: (data.questions || []).filter((item) => item.workspace_id === workspace?.id),
        messages: (data.messages || []).filter((item) => item.workspace_id === workspace?.id)
      };
    },
    async setWorkspace(workspaceId) {
      const data = readDemo();
      data.activeWorkspaceId = workspaceId;
      data.workspace = activeDemoWorkspace(data);
      writeDemo(data);
    },
    async createWorkspace(name) {
      const data = readDemo();
      const workspace = {
        id: uid(),
        name,
        invite_code: `TEAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        created_at: new Date().toISOString()
      };
      data.workspaces = [workspace, ...(data.workspaces || [])];
      data.workspace = workspace;
      data.activeWorkspaceId = workspace.id;
      const isDemoSuperAdmin = data.members.some((member) => member.user_id === data.sessionUserId && member.role === "super_admin" && member.status !== "disabled");
      data.members.push({ workspace_id: workspace.id, user_id: data.sessionUserId, role: isDemoSuperAdmin ? "super_admin" : "admin", status: "active" });
      data.projects = [
        { id: uid(), workspace_id: workspace.id, name: "일반", color: "#2563eb" },
        ...(data.projects || [])
      ];
      data.messages = [
        {
          id: uid(),
          workspace_id: workspace.id,
          sender_id: data.sessionUserId,
          body: `${workspace.name} 팀 메시지가 시작되었습니다.`,
          is_private: false,
          replies: [],
          read_by: [data.sessionUserId],
          created_at: new Date().toISOString()
        },
        ...(data.messages || [])
      ];
      writeDemo(data);
      return workspace;
    },
    async joinWorkspaceByCode(code) {
      const data = readDemo();
      const workspace = data.workspaces.find((item) => String(item.invite_code || "").toLowerCase() === String(code || "").toLowerCase());
      if (!workspace) throw new Error("초대 코드를 찾을 수 없습니다.");
      if (!data.members.some((item) => item.workspace_id === workspace.id && item.user_id === data.sessionUserId)) {
        data.members.push({ workspace_id: workspace.id, user_id: data.sessionUserId, role: "member", status: "active" });
      }
      data.activeWorkspaceId = workspace.id;
      data.workspace = workspace;
      writeDemo(data);
    },
    async updateProfile(profile) {
      const data = readDemo();
      data.users = data.users.map((user) => user.id === data.sessionUserId ? { ...user, ...profile } : user);
      if (data.sessionUserId === state.user?.id) {
        state.user = {
          ...state.user,
          email: profile.email || state.user.email,
          name: profile.full_name || state.user.name
        };
      }
      writeDemo(data);
    },
    async createInvite(invite) {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      const record = {
        id: uid(),
        workspace_id: workspace.id,
        email: invite.email,
        role: invite.role,
        code: invite.code || `${workspace.invite_code || workspace.id.slice(0, 6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        status: "invited",
        created_at: new Date().toISOString()
      };
      data.invites = [record, ...(data.invites || [])];
      const existing = data.users.find((user) => user.email === invite.email);
      if (existing && !data.members.some((item) => item.workspace_id === workspace.id && item.user_id === existing.id)) {
        data.members.push({ workspace_id: workspace.id, user_id: existing.id, role: invite.role, status: "invited" });
      }
      writeDemo(data);
      return record;
    },
    async updateMember(userId, patch) {
      const data = readDemo();
      const { position, ...memberPatch } = patch;
      const workspace = activeDemoWorkspace(data);
      data.members = data.members.map((member) => member.workspace_id === workspace.id && member.user_id === userId
        ? { ...member, ...memberPatch }
        : member);
      if (Object.prototype.hasOwnProperty.call(patch, "position")) {
        data.users = data.users.map((user) => user.id === userId ? { ...user, position } : user);
      }
      writeDemo(data);
    },
    async removeMember(userId) {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      data.members = data.members.map((member) => member.workspace_id === workspace.id && member.user_id === userId
        ? { ...member, status: "disabled" }
        : member);
      writeDemo(data);
    },
    async createTask(task) {
      const data = readDemo();
      const record = {
        ...task,
        id: uid(),
        workspace_id: data.workspace.id,
        creator_id: data.sessionUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      data.tasks.unshift(record);
      writeDemo(data);
      return record;
    },
    async updateTask(id, patch) {
      const data = readDemo();
      data.tasks = data.tasks.map((task) => task.id === id ? { ...task, ...patch, updated_at: new Date().toISOString() } : task);
      writeDemo(data);
      return data.tasks.find((task) => task.id === id);
    },
    async addComment(taskId, body) {
      const data = readDemo();
      const comment = {
        id: uid(),
        task_id: taskId,
        author_id: data.sessionUserId,
        body,
        created_at: new Date().toISOString()
      };
      data.comments.push(comment);
      writeDemo(data);
      return comment;
    },
    async createNotice(notice) {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      const record = {
        ...notice,
        id: uid(),
        workspace_id: workspace.id,
        author_id: data.sessionUserId,
        created_at: new Date().toISOString()
      };
      data.notices.unshift(record);
      writeDemo(data);
      return record;
    },
    async updateNotice(id, patch) {
      const data = readDemo();
      data.notices = data.notices.map((notice) => notice.id === id
        ? { ...notice, ...patch, updated_at: new Date().toISOString() }
        : notice);
      writeDemo(data);
      return data.notices.find((notice) => notice.id === id);
    },
    async createQuestion(question) {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      const record = {
        ...question,
        id: uid(),
        workspace_id: workspace.id,
        author_id: data.sessionUserId,
        status: "open",
        replies: [],
        created_at: new Date().toISOString()
      };
      data.questions = [record, ...(data.questions || [])];
      writeDemo(data);
      return record;
    },
    async replyQuestion(questionId, body) {
      const data = readDemo();
      data.questions = (data.questions || []).map((question) => question.id === questionId
        ? {
            ...question,
            status: "answered",
            replies: [
              ...(question.replies || []),
              { id: uid(), author_id: data.sessionUserId, body, created_at: new Date().toISOString() }
            ]
          }
        : question);
      writeDemo(data);
    },
    async createMessage(message) {
      const data = readDemo();
      const workspace = activeDemoWorkspace(data);
      const record = {
        ...message,
        id: uid(),
        workspace_id: workspace.id,
        sender_id: data.sessionUserId,
        replies: [],
        read_by: [data.sessionUserId],
        created_at: new Date().toISOString()
      };
      data.messages = [record, ...(data.messages || [])];
      writeDemo(data);
      return record;
    },
    async replyMessage(messageId, body) {
      const data = readDemo();
      data.messages = (data.messages || []).map((message) => message.id === messageId
        ? {
            ...message,
            replies: [
              ...(message.replies || []),
              { id: uid(), author_id: data.sessionUserId, body, created_at: new Date().toISOString() }
            ],
            read_by: [data.sessionUserId]
          }
        : message);
      writeDemo(data);
    },
    async markMessageRead(messageId) {
      const data = readDemo();
      data.messages = (data.messages || []).map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          read_by: Array.from(new Set([...(message.read_by || []), data.sessionUserId]))
        };
      });
      writeDemo(data);
    }
  };
}

function makeLiveApi() {
  return {
    async session() {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      return user ? {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email
      } : null;
    },
    async signIn(email, password) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.email
      };
    },
    async signUp(email, password, fullName) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || email } }
      });
      if (error) throw error;
      if (!data.user) throw new Error("회원가입 응답이 비어 있습니다.");
      return {
        id: data.user.id,
        email: data.user.email,
        name: fullName || data.user.email
      };
    },
    async signOut() {
      await supabaseClient.auth.signOut();
    },
    async load() {
      const user = state.user;
      await supabaseClient
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.name || user.email
        }, { onConflict: "id", ignoreDuplicates: true });

      let { data: memberships, error: memberError } = await supabaseClient
        .from("workspace_members")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "remote", "leave"]);
      if (memberError) throw memberError;

      let workspace;
      let workspaces = [];
      let role = memberships?.[0]?.role || "admin";
      let allWorkspaces = [];
      let allMemberships = [];
      let allTasks = [];
      const isGlobalAdmin = memberships?.some((item) => item.role === "super_admin");

      if (!memberships?.length) {
        return {
          noWorkspace: true,
          workspace: null,
          workspaces: [],
          allWorkspaces: [],
          allMemberships: [],
          allTasks: [],
          role: "guest",
          members: [],
          invites: [],
          profiles: [{ id: user.id, email: user.email, full_name: user.name || user.email, avatar_url: "" }],
          projects: [],
          tasks: [],
          comments: [],
          notices: [],
          questions: [],
          messages: []
        };
      } else {
        const workspaceIds = memberships.map((item) => item.workspace_id);
        const workspaceQuery = supabaseClient
          .from("workspaces")
          .select("*");
        const { data: workspaceData, error: workspaceFetchError } = isGlobalAdmin
          ? await workspaceQuery
          : await workspaceQuery.in("id", workspaceIds);
        if (workspaceFetchError) throw workspaceFetchError;
        workspaces = workspaceData || [];
        workspace = workspaces.find((item) => item.id === state.workspace?.id) || workspaces[0];
        role = isGlobalAdmin ? "super_admin" : memberships.find((item) => item.workspace_id === workspace?.id)?.role || "member";
      }

      const [
        membersResult,
        projectsResult,
        tasksResult,
        commentsResult,
        noticesResult,
        questionsResult,
        messagesResult,
        invitesResult
      ] = await Promise.all([
        supabaseClient.from("workspace_members").select("*").eq("workspace_id", workspace.id).neq("status", "disabled"),
        supabaseClient.from("projects").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: true }),
        supabaseClient.from("tasks").select("*").eq("workspace_id", workspace.id).is("archived_at", null).order("created_at", { ascending: false }),
        supabaseClient.from("task_comments").select("*").order("created_at", { ascending: true }),
        supabaseClient.from("notices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabaseClient.from("questions").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabaseClient.from("messages").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabaseClient.from("team_invites").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
      ]);

      for (const result of [membersResult, projectsResult, tasksResult, commentsResult, noticesResult, questionsResult, messagesResult, invitesResult]) {
        if (result.error) throw result.error;
      }

      const memberIds = membersResult.data.map((item) => item.user_id);
      if (isGlobalAdmin) {
        const [allMembersResult, allTasksResult] = await Promise.all([
          supabaseClient.from("workspace_members").select("*").neq("status", "disabled"),
          supabaseClient.from("tasks").select("*").is("archived_at", null).order("created_at", { ascending: false })
        ]);
        for (const result of [allMembersResult, allTasksResult]) {
          if (result.error) throw result.error;
        }
        allWorkspaces = workspaces;
        allMemberships = allMembersResult.data || [];
        allTasks = allTasksResult.data || [];
      }
      const profileIds = Array.from(new Set([
        ...memberIds,
        ...(allMemberships || []).map((item) => item.user_id),
        user.id
      ]));
      const { data: profiles, error: profilesError } = await supabaseClient
        .from("profiles")
        .select("*")
        .in("id", profileIds.length ? profileIds : [user.id]);
      if (profilesError) throw profilesError;

      return {
        workspace,
        workspaces,
        allWorkspaces: allWorkspaces.length ? allWorkspaces : workspaces,
        allMemberships: allMemberships.length
          ? allMemberships
          : Array.from(new Map([...(memberships || []), ...(membersResult.data || [])].map((item) => [`${item.workspace_id}:${item.user_id}`, item])).values()),
        allTasks: allTasks.length ? allTasks : tasksResult.data || [],
        role,
        noWorkspace: false,
        members: membersResult.data || [],
        invites: invitesResult.data || [],
        profiles: profiles || [],
        projects: projectsResult.data || [],
        tasks: tasksResult.data || [],
        comments: commentsResult.data || [],
        notices: noticesResult.data || [],
        questions: (questionsResult.data || []).map((question) => ({ ...question, replies: question.replies || [] })),
        messages: (messagesResult.data || []).map((message) => ({
          ...message,
          replies: message.replies || [],
          read_by: message.read_by || []
        }))
      };
    },
    async createTask(task) {
      const { data, error } = await supabaseClient
        .from("tasks")
        .insert({
          ...task,
          workspace_id: state.workspace.id,
          creator_id: state.user.id
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async setWorkspace(workspaceId) {
      state.workspace = state.workspaces.find((workspace) => workspace.id === workspaceId) || state.workspace;
    },
    async createWorkspace(name) {
      const inviteCodeValue = `TEAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { data: workspace, error: workspaceError } = await supabaseClient
        .from("workspaces")
        .insert({ name, owner_id: state.user.id, invite_code: inviteCodeValue })
        .select("*")
        .single();
      if (workspaceError) throw workspaceError;
      const { error: memberError } = await supabaseClient
        .from("workspace_members")
        .insert({ workspace_id: workspace.id, user_id: state.user.id, role: isSuperAdmin() ? "super_admin" : "admin", status: "active" });
      if (memberError) throw memberError;
      const { error: projectError } = await supabaseClient
        .from("projects")
        .insert({ workspace_id: workspace.id, name: "일반", color: "#2563eb" });
      if (projectError) throw projectError;
      const { error: messageError } = await supabaseClient
        .from("messages")
        .insert({
          workspace_id: workspace.id,
          sender_id: state.user.id,
          body: `${name} 팀 메시지가 시작되었습니다.`,
          is_private: false,
          read_by: [state.user.id]
        });
      if (messageError) throw messageError;
      return workspace;
    },
    async joinWorkspaceByCode(code) {
      const { error } = await supabaseClient.rpc("join_workspace_by_invite", { invite_code_input: code });
      if (error) throw error;
    },
    async updateProfile(profile) {
      const nextEmail = profile.email?.trim();
      const nextName = profile.full_name?.trim();
      if (nextEmail && nextEmail !== state.user.email) {
        const { error: authEmailError } = await supabaseClient.auth.updateUser({ email: nextEmail });
        if (authEmailError) throw authEmailError;
      }
      if (nextName && nextName !== state.user.name) {
        const { error: authMetaError } = await supabaseClient.auth.updateUser({ data: { full_name: nextName } });
        if (authMetaError) throw authMetaError;
      }
      const { error } = await supabaseClient
        .from("profiles")
        .update(profile)
        .eq("id", state.user.id);
      if (error) throw error;
      state.user = {
        ...state.user,
        email: nextEmail || state.user.email,
        name: nextName || state.user.name
      };
    },
    async createInvite(invite) {
      const { data, error } = await supabaseClient
        .from("team_invites")
        .insert({
          workspace_id: state.workspace.id,
          email: invite.email,
          role: invite.role,
          code: invite.code || `${inviteCode()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          invited_by: state.user.id,
          status: "invited"
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async updateMember(userId, patch) {
      const { position, ...memberPatch } = patch;
      if (Object.keys(memberPatch).length) {
        const { error } = await supabaseClient
          .from("workspace_members")
          .update(memberPatch)
          .eq("workspace_id", state.workspace.id)
          .eq("user_id", userId);
        if (error) throw error;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "position")) {
        const { error } = await supabaseClient
          .from("profiles")
          .update({ position })
          .eq("id", userId);
        if (error) throw error;
      }
    },
    async removeMember(userId) {
      const { error } = await supabaseClient
        .from("workspace_members")
        .update({ status: "disabled" })
        .eq("workspace_id", state.workspace.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    async updateTask(id, patch) {
      const { data, error } = await supabaseClient
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async addComment(taskId, body) {
      const { data, error } = await supabaseClient
        .from("task_comments")
        .insert({ task_id: taskId, author_id: state.user.id, body })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async createNotice(notice) {
      const { data, error } = await supabaseClient
        .from("notices")
        .insert({
          ...notice,
          workspace_id: state.workspace.id,
          author_id: state.user.id
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async updateNotice(id, patch) {
      const { data, error } = await supabaseClient
        .from("notices")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async createQuestion(question) {
      const { data, error } = await supabaseClient
        .from("questions")
        .insert({
          ...question,
          workspace_id: state.workspace.id,
          author_id: state.user.id,
          status: "open",
          replies: []
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async replyQuestion(questionId, body) {
      const question = state.questions.find((item) => item.id === questionId);
      const replies = [
        ...(question?.replies || []),
        { id: uid(), author_id: state.user.id, body, created_at: new Date().toISOString() }
      ];
      const { error } = await supabaseClient
        .from("questions")
        .update({ replies, status: "answered" })
        .eq("id", questionId);
      if (error) throw error;
    },
    async createMessage(message) {
      const { data, error } = await supabaseClient
        .from("messages")
        .insert({
          ...message,
          workspace_id: state.workspace.id,
          sender_id: state.user.id,
          replies: [],
          read_by: [state.user.id]
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async replyMessage(messageId, body) {
      const message = state.messages.find((item) => item.id === messageId);
      const replies = [
        ...(message?.replies || []),
        { id: uid(), author_id: state.user.id, body, created_at: new Date().toISOString() }
      ];
      const { error } = await supabaseClient
        .from("messages")
        .update({ replies, read_by: [state.user.id] })
        .eq("id", messageId);
      if (error) throw error;
    },
    async markMessageRead(messageId) {
      const message = state.messages.find((item) => item.id === messageId);
      if (!message || (message.read_by || []).includes(state.user.id)) return;
      const readBy = Array.from(new Set([...(message.read_by || []), state.user.id]));
      const { error } = await supabaseClient
        .from("messages")
        .update({ read_by: readBy })
        .eq("id", messageId);
      if (error) throw error;
    }
  };
}

const api = HAS_SUPABASE ? makeLiveApi() : makeDemoApi();

async function boot() {
  try {
    state.user = await api.session();
    if (state.user) await refreshData();
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "초기화 중 문제가 생겼습니다.");
    renderAuth();
  }
}

async function refreshData() {
  const data = await api.load();
  state = { ...state, ...data };
}

function filteredTasks(scope = state.view) {
  let tasks = [...state.tasks];
  if (scope === "mine") {
    tasks = tasks.filter((task) => task.assignee_id === state.user.id || task.creator_id === state.user.id);
  }
  if (scope === "dashboard") {
    tasks = tasks.filter((task) => task.status !== "done");
  }
  const search = state.filters.search.trim().toLowerCase();
  if (search) {
    tasks = tasks.filter((task) =>
      [task.title, task.description, profileName(task.assignee_id)]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }
  if (state.filters.status !== "all") tasks = tasks.filter((task) => task.status === state.filters.status);
  if (state.filters.assignee !== "all") tasks = tasks.filter((task) => task.assignee_id === state.filters.assignee);
  if (state.filters.priority !== "all") tasks = tasks.filter((task) => task.priority === state.filters.priority);
  return tasks;
}

function filteredNotices() {
  const search = state.filters.noticeSearch.trim().toLowerCase();
  return [...state.notices]
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .filter((notice) => {
      if (!search) return true;
      return [notice.title, notice.body, profileName(notice.author_id)]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
}

function noticePageData() {
  const pageSize = 8;
  const notices = filteredNotices();
  const totalPages = Math.max(1, Math.ceil(notices.length / pageSize));
  const page = Math.min(Math.max(1, Number(state.filters.noticePage) || 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    notices,
    page,
    totalPages,
    visible: notices.slice(start, start + pageSize)
  };
}

function stats() {
  const myTasks = state.tasks.filter((task) => task.assignee_id === state.user?.id || task.creator_id === state.user?.id);
  return {
    mine: myTasks.filter((task) => task.status !== "done").length,
    dueToday: state.tasks.filter((task) => task.due_date === today() && task.status !== "done").length,
    overdue: state.tasks.filter(isOverdue).length,
    review: state.tasks.filter((task) => task.status === "review").length,
    openQuestions: state.questions.filter((question) => question.status !== "answered").length,
    privateMessages: state.messages.filter((message) => message.is_private).length
  };
}

function isManager() {
  return ["super_admin", "admin", "manager"].includes(state.role);
}

function isSuperAdmin() {
  return state.role === "super_admin";
}

function isAdmin() {
  return ["super_admin", "admin"].includes(state.role);
}

function canManageMember(userId) {
  if (!userId || userId === state.user?.id) return false;
  const targetRole = memberRecord(userId)?.role;
  if (isSuperAdmin()) return targetRole !== "super_admin";
  if (state.role === "admin") return ["manager", "member", "guest"].includes(targetRole);
  return false;
}

function assignableRoles() {
  return isSuperAdmin() ? ["admin", "manager", "member", "guest"] : ["manager", "member", "guest"];
}

function memberRecord(userId) {
  return state.members.find((member) => member.user_id === userId);
}

function allWorkspaces() {
  return state.allWorkspaces?.length ? state.allWorkspaces : state.workspaces;
}

function allMemberships() {
  return state.allMemberships?.length ? state.allMemberships : state.members;
}

function allTasks() {
  return state.allTasks?.length ? state.allTasks : state.tasks;
}

function workspaceName(workspaceId) {
  const workspace = allWorkspaces().find((item) => item.id === workspaceId);
  return workspace?.name || "알 수 없는 팀";
}

function userMemberships(userId = state.user?.id) {
  return allMemberships().filter((item) => item.user_id === userId && item.status !== "disabled");
}

function isMine(authorId) {
  return Boolean(authorId && authorId === state.user?.id);
}

function memberRole(userId) {
  return allMemberships().find((item) => item.workspace_id === state.workspace?.id && item.user_id === userId)?.role || memberRecord(userId)?.role || "guest";
}

function inviteCode() {
  return state.workspace?.invite_code || state.workspace?.id?.slice(0, 8) || "team";
}

function inviteLink() {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?invite=${encodeURIComponent(inviteCode())}`;
}

function visibleMessages() {
  return state.messages.filter((message) =>
    !message.is_private ||
    message.sender_id === state.user?.id ||
    message.recipient_id === state.user?.id
  );
}

function roleBadge(role = state.role, showText = false, compact = false) {
  const meta = ROLE_META[role] || ROLE_META.guest;
  return `<span class="role-dot ${meta.className} ${compact ? "compact" : ""}" title="${meta.label}" aria-label="${meta.label}">${meta.icon}${showText ? `<span>${meta.label}</span>` : ""}</span>`;
}

function workspaceSelect() {
  if (!state.workspaces?.length) return `<span class="workspace-chip">${escapeHtml(state.workspace?.name || "워크스페이스")}</span>`;
  const canCreateWorkspace = isSuperAdmin();
  return `
    <div class="workspace-picker ${state.workspaceMenuOpen ? "open" : ""}">
      <button type="button" class="workspace-trigger" data-action="toggle-workspace-menu" aria-expanded="${state.workspaceMenuOpen}">
        <span class="workspace-kicker">팀 전환</span>
        <span class="workspace-name">${escapeHtml(state.workspace?.name || "워크스페이스")}</span>
        <span class="workspace-arrow">⌄</span>
      </button>
      ${state.workspaceMenuOpen ? `
        <div class="workspace-menu">
          ${state.workspaces.map((workspace) => `
            <button type="button" class="${workspace.id === state.workspace?.id ? "active" : ""}" data-workspace-choice="${workspace.id}">
              <span>${escapeHtml(workspace.name)}</span>
              ${workspace.id === state.workspace?.id ? `<strong>현재</strong>` : ""}
            </button>
          `).join("")}
          ${canCreateWorkspace ? `
            <div class="workspace-menu-divider"></div>
            ${state.creatingWorkspaceFromMenu ? `
              <form class="workspace-create-form" data-create-workspace-form>
                <input class="input" name="name" placeholder="새 팀 이름" required>
                <button class="btn primary">팀 추가</button>
              </form>
            ` : `
              <button type="button" class="workspace-add" data-action="show-workspace-create">
                <span>새 팀 추가</span>
                <strong>+</strong>
              </button>
            `}
          ` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function render() {
  applyTheme();
  if (!state.user) {
    renderAuth();
    return;
  }
  if (state.noWorkspace) {
    renderNoWorkspace();
    return;
  }
  const profile = currentProfile();
  app.innerHTML = `
    <div class="app-shell ${state.theme === "dark" ? "dark" : "light"}">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">W</div>
          <span><strong>Work To Do</strong><span>팀 업무와 개인 할 일을 한 곳에서</span></span>
        </div>
        <nav class="top-nav" aria-label="빠른 메뉴">
          ${topNavButton("messages", "메시지")}
          ${topNavButton("questions", "질문 게시판")}
        </nav>
        <div class="top-actions">
          ${workspaceSelect()}
          <button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="다크모드 전환" title="다크모드 전환">${state.theme === "dark" ? "☀" : "◐"}</button>
          <button class="role-chip role-button" data-view="profile">${roleBadge(state.role, true)}<span>${escapeHtml(profile.full_name || profile.email)}</span></button>
          <span class="mode-chip ${state.mode === "live" ? "live" : ""}">${state.mode === "live" ? "DB 연결됨" : "데모 모드"}</span>
          <button class="btn ghost" data-action="logout">로그아웃</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          ${navButton("home", "홈")}
          ${navButton("tasks", "업무")}
          ${navButton("notices", "공지")}
          ${navButton("dashboard", isSuperAdmin() ? "전체 관리자" : isAdmin() ? "관리자" : "팀원")}
          <div class="side-panel">
            <h3>빠른 안내</h3>
            <p>${state.mode === "live"
              ? "현재 Supabase DB에 연결되어 있습니다. 업무와 공지가 서버에 저장됩니다."
              : "Supabase 환경변수를 넣으면 같은 화면이 실제 DB 기반으로 전환됩니다."}</p>
          </div>
        </aside>
        <main class="main">
          <div class="page-panel" data-current-view="${state.view}">
            ${renderPage()}
          </div>
        </main>
      </div>
      ${renderNoticeModal()}
      ${renderTaskModal()}
      ${renderFormModal()}
      ${renderProfileEditModal()}
      ${renderMemberActionMenu()}
      ${renderMemberEditModal()}
    </div>
  `;
  bindEvents();
}

function renderNoWorkspace() {
  applyTheme();
  const profile = currentProfile();
  app.innerHTML = `
    <main class="empty-workspace-page">
      <section class="empty-workspace-card">
        <div class="brand">
          <div class="brand-mark">W</div>
          <span><strong>Work To Do</strong><span>${escapeHtml(profile.full_name || profile.email || "새 사용자")}</span></span>
        </div>
        <h1>아직 참여 중인 팀이 없습니다.</h1>
        <p>팀 초대를 받으면 해당 팀 업무가 열립니다. 새 팀을 만들면 바로 관리자로 시작할 수 있습니다.</p>
        <form class="form" data-create-workspace-form>
          <input class="input" name="name" placeholder="새 팀 이름" required>
          <button class="btn primary">새 팀 만들기</button>
        </form>
        <div class="divider-text">또는</div>
        <form class="form" data-join-workspace-form>
          <input class="input" name="code" placeholder="팀 초대 코드" required>
          <button class="btn">초대 코드로 참여</button>
        </form>
        <button class="btn ghost" data-action="logout">로그아웃</button>
      </section>
    </main>
  `;
  bindNoWorkspaceEvents();
}

function navButton(view, label, hidden = false, quick = false) {
  return `<button class="nav-button ${quick ? "quick" : ""} ${state.view === view ? "active" : ""}" data-view="${view}" ${hidden ? "hidden" : ""}>${label}</button>`;
}

function topNavButton(view, label) {
  return `<button class="top-nav-button ${state.view === view ? "active" : ""}" data-view="${view}">${label}</button>`;
}

function renderPage() {
  if (state.view === "home") return renderHome();
  if (state.view === "tasks") return renderTaskList();
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "notices") return renderNotices();
  if (state.view === "questions") return renderQuestions();
  if (state.view === "messages") return renderMessages();
  if (state.view === "profile") return renderProfile();
  return renderHome();
}

function renderHead(title, body, action = "") {
  return `
    <div class="page-head">
      <div>
        <h1>${title}</h1>
        <p>${body}</p>
      </div>
      ${action}
    </div>
  `;
}

function renderStats() {
  const data = stats();
  return `
    <div class="grid stats">
      <div class="stat-card"><span>내 미완료</span><strong>${data.mine}</strong></div>
      <div class="stat-card"><span>오늘 마감</span><strong>${data.dueToday}</strong></div>
      <div class="stat-card"><span>지연 업무</span><strong>${data.overdue}</strong></div>
      <div class="stat-card"><span>검토 대기</span><strong>${data.review}</strong></div>
    </div>
  `;
}

function renderCompactStats() {
  const data = stats();
  return `
    <div class="compact-stats">
      <span>내 미완료 <strong>${data.mine}</strong></span>
      <span>오늘 마감 <strong>${data.dueToday}</strong></span>
      <span>지연 <strong>${data.overdue}</strong></span>
      <span>검토 <strong>${data.review}</strong></span>
    </div>
  `;
}

function renderHome() {
  const myTasks = filteredTasks("mine").filter((task) => task.status !== "done").slice(0, 3);
  const teamTasks = filteredTasks("team").filter((task) => task.status !== "done").slice(0, 3);
  const notices = [...state.notices].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).slice(0, 6);
  return `
    ${renderHead("오늘 볼 일", `${escapeHtml(state.workspace?.name || "팀")}의 핵심 업무와 공지만 빠르게 확인합니다.`)}
    ${renderCompactStats()}
    <div class="home-dashboard">
      <div class="home-left">
        <section class="home-section task-blue">
          <div class="section-title">
            <h2>내 업무</h2>
            <button class="btn ghost" data-view="tasks" data-task-scope="mine">전체보기</button>
          </div>
          <div class="title-list">
            ${myTasks.length ? myTasks.map(renderTitleTask).join("") : `<div class="empty small">내 미완료 업무가 없습니다.</div>`}
          </div>
        </section>
        <section class="home-section task-orange">
          <div class="section-title">
            <h2>팀 업무</h2>
            <button class="btn ghost" data-view="tasks" data-task-scope="team">전체보기</button>
          </div>
          <div class="title-list">
            ${teamTasks.length ? teamTasks.map(renderTitleTask).join("") : `<div class="empty small">팀 미완료 업무가 없습니다.</div>`}
          </div>
        </section>
      </div>
      <section class="home-section notices-home">
        <div class="section-title">
          <h2>공지</h2>
          <button class="btn ghost" data-view="notices">전체보기</button>
        </div>
        <div class="title-list notice-title-list">
          ${notices.length ? notices.map(renderTitleNotice).join("") : `<div class="empty small">표시할 공지가 없습니다.</div>`}
        </div>
      </section>
    </div>
  `;
}

function renderTitleTask(task) {
  return `
    <button class="title-row" data-action="open-task" data-task-id="${task.id}">
      <span>${escapeHtml(task.title)}</span>
      <small>${STATUS_LABEL[task.status] || task.status}</small>
    </button>
  `;
}

function renderTitleNotice(notice) {
  return `
    <button class="title-row notice-row" data-action="open-notice" data-notice-id="${notice.id}">
      <span>${escapeHtml(notice.title)}</span>
      ${notice.pinned ? `<small>고정</small>` : `<small>${escapeHtml(profileName(notice.author_id))}</small>`}
    </button>
  `;
}

function renderMiniTaskCard(task) {
  return `
    <article class="mini-task home-mini-task">
      <strong>${escapeHtml(task.title)}</strong>
      <div class="task-meta">
        <span class="pill">${STATUS_LABEL[task.status] || task.status}</span>
        <span class="pill">${escapeHtml(profileName(task.assignee_id))}</span>
        ${task.due_date ? `<span class="pill ${isOverdue(task) ? "overdue" : ""}">${escapeHtml(task.due_date)}</span>` : ""}
      </div>
    </article>
  `;
}

function renderFilters() {
  return `
    <div class="toolbar">
      <input class="input" data-filter="search" placeholder="제목, 설명, 담당자 검색" value="${escapeHtml(state.filters.search)}">
      <select data-filter="status">
        ${option("all", "전체 상태", state.filters.status)}
        ${Object.entries(STATUS_LABEL).map(([value, label]) => option(value, label, state.filters.status)).join("")}
      </select>
      <select data-filter="assignee">
        ${option("all", "전체 담당자", state.filters.assignee)}
        ${state.profiles.map((profile) => option(profile.id, profile.full_name || profile.email, state.filters.assignee)).join("")}
      </select>
      <select data-filter="priority">
        ${option("all", "전체 우선순위", state.filters.priority)}
        ${Object.entries(PRIORITY_LABEL).map(([value, label]) => option(value, label, state.filters.priority)).join("")}
      </select>
    </div>
  `;
}

function renderTaskScopeTabs(scope) {
  return `
    <div class="task-scope-tabs" aria-label="업무 범위">
      <button class="${scope === "mine" ? "active" : ""}" data-task-scope="mine">내 업무</button>
      <button class="${scope === "team" ? "active" : ""}" data-task-scope="team">팀 업무</button>
    </div>
  `;
}

function option(value, label, current) {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderTaskList(scope = state.taskScope) {
  const title = scope === "team" ? "팀 업무" : "내 업무";
  const body = scope === "team"
    ? "팀 전체 업무를 담당자, 상태, 우선순위 기준으로 훑어봅니다."
    : "나에게 배정되었거나 내가 만든 업무를 먼저 처리합니다.";
  const tasks = filteredTasks(scope);
  return `
    <div class="task-page ${scope === "team" ? "task-page-team" : "task-page-mine"}">
      ${renderHead("업무", `${title}를 기준으로 업무를 정리합니다. ${body}`, `<button class="btn primary" data-action="open-form" data-form-kind="task">새 업무</button>`)}
      <section class="task-workspace ${scope === "team" ? "team-scope" : "mine-scope"}">
        ${renderTaskScopeTabs(scope)}
        ${renderStats()}
        ${renderFilters()}
      </section>
      ${renderTaskBoard(tasks)}
      <section class="list task-list">
        ${tasks.length ? tasks.map(renderTaskCard).join("") : `<div class="empty">조건에 맞는 업무가 없습니다.</div>`}
      </section>
    </div>
  `;
}

function renderTaskCard(task) {
  const comments = state.comments.filter((comment) => comment.task_id === task.id);
  const project = state.projects.find((item) => item.id === task.project_id);
  const editable = isMine(task.creator_id);
  return `
    <article class="task-card">
      <div class="task-top">
        <div>
          <h2 class="task-title">${escapeHtml(task.title)}</h2>
          <p class="task-desc">${escapeHtml(task.description || "")}</p>
        </div>
        <span class="pill ${task.priority}">${PRIORITY_LABEL[task.priority] || task.priority}</span>
      </div>
      <div class="task-meta">
        <span class="pill">${STATUS_LABEL[task.status] || task.status}</span>
        <span class="pill">담당 ${escapeHtml(profileName(task.assignee_id))}</span>
        ${project ? `<span class="pill">${escapeHtml(project.name)}</span>` : ""}
        ${task.due_date ? `<span class="pill ${isOverdue(task) ? "overdue" : ""}">마감 ${escapeHtml(task.due_date)}</span>` : ""}
      </div>
      <div class="task-actions">
        ${editable ? `
          <select data-task-status="${task.id}" aria-label="업무 상태 변경">
            ${Object.entries(STATUS_LABEL).map(([value, label]) => option(value, label, task.status)).join("")}
          </select>
          <button class="btn" data-action="edit-task" data-task-id="${task.id}">수정</button>
        ` : ""}
        <button class="btn" data-action="toggle-comments" data-task-id="${task.id}">댓글 ${comments.length}</button>
      </div>
      <div class="comment-list hidden" data-comments="${task.id}">
        ${comments.length ? comments.map(renderComment).join("") : `<div class="muted">아직 댓글이 없습니다.</div>`}
        <form class="form" data-comment-form="${task.id}">
          <input class="input" name="body" placeholder="댓글을 입력하세요" required>
          <button class="btn">댓글 저장</button>
        </form>
      </div>
    </article>
  `;
}

function renderComment(comment) {
  return `
    <div class="comment">
      <strong>${escapeHtml(profileName(comment.author_id))}</strong>
      <span>${escapeHtml(comment.body)}</span>
    </div>
  `;
}

function renderTaskForm() {
  const editing = state.editingTaskId ? state.tasks.find((task) => task.id === state.editingTaskId) : null;
  const draft = editing || loadDraft("task");
  return `
      <form class="form" data-task-form ${editing ? `data-edit-task-id="${editing.id}"` : `data-draft="task"`}>
        <input class="input" name="title" placeholder="업무 제목" value="${escapeHtml(draft.title || "")}" required>
        <textarea name="description" placeholder="업무 설명">${escapeHtml(draft.description || "")}</textarea>
        <div class="form-row">
          <select name="assignee_id">
            ${state.profiles.map((profile) => option(profile.id, profile.full_name || profile.email, draft.assignee_id || state.user.id)).join("")}
          </select>
          <select name="priority">
            ${Object.entries(PRIORITY_LABEL).map(([value, label]) => option(value, label, draft.priority || "normal")).join("")}
          </select>
        </div>
        <div class="form-row">
          <select name="status">
            ${Object.entries(STATUS_LABEL).map(([value, label]) => option(value, label, draft.status || "todo")).join("")}
          </select>
          <input class="input" name="due_date" type="date" value="${escapeHtml(draft.due_date || "")}">
        </div>
        <select name="project_id">
          <option value="">프로젝트 없음</option>
          ${state.projects.map((project) => option(project.id, project.name, draft.project_id || "")).join("")}
        </select>
        <button class="btn primary">${editing ? "업무 수정" : "업무 저장"}</button>
      </form>
  `;
}

function renderTaskBoard(tasks) {
  return `
    <section class="task-board-panel">
      <div class="section-title">
        <h2>상태 보드</h2>
        <span class="muted">${tasks.length}개 업무</span>
      </div>
      <div class="board">
      ${Object.entries(STATUS_LABEL).map(([status, label]) => `
        <section class="column">
          <h3>${label}</h3>
          ${tasks.filter((task) => task.status === status).map((task) => `
            <button class="mini-task board-mini-task" data-action="open-task" data-task-id="${task.id}">
              <strong>${escapeHtml(task.title)}</strong>
              <div class="task-meta">
                <span class="pill">${escapeHtml(profileName(task.assignee_id))}</span>
                <span class="pill ${task.priority}">${PRIORITY_LABEL[task.priority]}</span>
              </div>
            </button>
          `).join("") || `<div class="empty">비어 있음</div>`}
        </section>
      `).join("")}
      </div>
    </section>
  `;
}

function renderDashboard() {
  if (isSuperAdmin()) return renderGlobalAdminDashboard();
  const tasks = filteredTasks("dashboard");
  const data = stats();
  const rows = state.profiles.filter((profile) => memberRecord(profile.id)).map((profile) => {
    const assigned = state.tasks.filter((task) => task.assignee_id === profile.id && task.status !== "done");
    return {
      name: profile.full_name || profile.email,
      open: assigned.length,
      overdue: assigned.filter(isOverdue).length,
      review: assigned.filter((task) => task.status === "review").length
    };
  });
  return `
    ${renderHead(isAdmin() ? "관리자" : "팀원", isAdmin()
      ? "인원 상태, 팀 초대, 팀 전체 진행 상황을 확인합니다."
      : "팀원을 확인하고 우클릭으로 개인 메시지를 시작합니다.")}
    ${renderStats()}
    <div class="grid stats">
      <div class="stat-card"><span>답변대기 질문</span><strong>${data.openQuestions}</strong></div>
      <div class="stat-card"><span>비공개 메시지</span><strong>${data.privateMessages}</strong></div>
      <div class="stat-card"><span>팀원</span><strong>${state.members.length}</strong></div>
      <div class="stat-card"><span>공지</span><strong>${state.notices.length}</strong></div>
    </div>
    <div class="admin-grid">
      <section class="card admin-card">
        <div class="section-title">
          <h2>인원 관리</h2>
          <span class="muted">${isAdmin() ? "팀원을 우클릭하면 관리 메뉴가 열립니다." : "팀원을 우클릭하면 메시지를 보낼 수 있습니다."}</span>
        </div>
        <table class="table member-table">
          <thead><tr><th>인원</th><th>직급</th><th>상태</th><th>이메일</th></tr></thead>
          <tbody>
            ${renderMemberRows()}
          </tbody>
        </table>
      </section>
      ${isAdmin() ? `<aside class="card invite-card">
        <h2>팀 초대</h2>
        <div class="invite-link-box">
          <span>초대 코드</span>
          <strong>${escapeHtml(inviteCode())}</strong>
          <button class="btn" data-action="copy-invite">초대 주소 복사</button>
        </div>
        <form class="form" data-invite-form>
          <input class="input" name="email" type="email" placeholder="초대할 이메일" required ${isAdmin() ? "" : "disabled"}>
          <select name="role" ${isAdmin() ? "" : "disabled"}>
            ${assignableRoles().map((role) => option(role, ROLE_LABEL[role], "member")).join("")}
          </select>
          <button class="btn primary" ${isAdmin() ? "" : "disabled"}>이메일 초대</button>
        </form>
        <div class="invite-list">
          ${state.invites.length ? state.invites.slice(0, 5).map((invite) => `
            <div class="invite-item">
              <strong>${escapeHtml(invite.email)}</strong>
              <span>${escapeHtml(ROLE_LABEL[invite.role] || invite.role)} · ${escapeHtml(invite.code || invite.status || "초대중")}</span>
            </div>
          `).join("") : `<div class="empty small">아직 보낸 초대가 없습니다.</div>`}
        </div>
      </aside>` : ""}
    </div>
    <div class="content-grid">
      <section class="card">
        <h2>지연 및 진행 업무</h2>
        <table class="table">
          <thead><tr><th>업무</th><th>담당자</th><th>상태</th><th>마감</th></tr></thead>
          <tbody>
            ${tasks.slice(0, 12).map((task) => `
              <tr>
                <td>${escapeHtml(task.title)}</td>
                <td>${escapeHtml(profileName(task.assignee_id))}</td>
                <td>${STATUS_LABEL[task.status]}</td>
                <td>${escapeHtml(task.due_date || "-")}</td>
              </tr>
            `).join("") || `<tr><td colspan="4">표시할 업무가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </section>
      <aside class="card">
        <h2>담당자별 현황</h2>
        <table class="table">
          <thead><tr><th>담당자</th><th>미완료</th><th>지연</th><th>검토</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${row.open}</td>
                <td>${row.overdue}</td>
                <td>${row.review}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </aside>
    </div>
  `;
}

function renderGlobalAdminDashboard() {
  const teams = allWorkspaces();
  const selectedId = state.workspace?.id || teams[0]?.id;
  const selectedTeam = teams.find((team) => team.id === selectedId) || teams[0];
  const selectedMembers = allMemberships().filter((member) => member.workspace_id === selectedTeam?.id && member.status !== "disabled");
  const selectedTasks = allTasks().filter((task) => task.workspace_id === selectedTeam?.id && task.status !== "done");
  const totalOpenTasks = allTasks().filter((task) => task.status !== "done").length;
  const totalOverdue = allTasks().filter(isOverdue).length;
  return `
    ${renderHead("전체 관리자", "모든 팀을 훑고 팀장과 팀별 진행 상황을 관리합니다.")}
    <div class="grid stats">
      <div class="stat-card"><span>전체 팀</span><strong>${teams.length}</strong></div>
      <div class="stat-card"><span>전체 인원</span><strong>${allMemberships().filter((item) => item.status !== "disabled").length}</strong></div>
      <div class="stat-card"><span>진행 업무</span><strong>${totalOpenTasks}</strong></div>
      <div class="stat-card"><span>지연 업무</span><strong>${totalOverdue}</strong></div>
    </div>

    <section class="card global-admin-card">
      <div class="section-title">
        <h2>팀 목록</h2>
        <span class="muted">팀을 누르면 해당 팀의 인원과 업무를 확인합니다.</span>
      </div>
      <div class="team-admin-list">
        ${teams.map((team) => {
          const teamMembers = allMemberships().filter((member) => member.workspace_id === team.id && member.status !== "disabled");
          const teamTasks = allTasks().filter((task) => task.workspace_id === team.id && task.status !== "done");
          const leads = teamMembers.filter((member) => member.role === "admin").map((member) => profileName(member.user_id));
          return `
            <button type="button" class="team-admin-item ${team.id === selectedTeam?.id ? "active" : ""}" data-admin-workspace-choice="${team.id}">
              <span>
                <strong>${escapeHtml(team.name)}</strong>
                <small>${escapeHtml(leads.join(", ") || "팀장 미지정")}</small>
              </span>
              <span class="team-admin-counts">
                <b>${teamMembers.length}</b>명
                <b>${teamTasks.length}</b>건
              </span>
            </button>
          `;
        }).join("")}
      </div>
    </section>

    <div class="admin-grid">
      <section class="card admin-card">
        <div class="section-title">
          <h2>${escapeHtml(selectedTeam?.name || "팀")} 인원</h2>
          <span class="muted">팀장까지 관리할 수 있습니다.</span>
        </div>
        <table class="table member-table">
          <thead><tr><th>인원</th><th>직급</th><th>상태</th><th>이메일</th></tr></thead>
          <tbody>
            ${renderMemberRows()}
          </tbody>
        </table>
      </section>
      <aside class="card invite-card">
        <h2>팀 요약</h2>
        <div class="invite-list">
          <div class="invite-item"><strong>${selectedMembers.length}명</strong><span>참여 인원</span></div>
          <div class="invite-item"><strong>${selectedTasks.length}건</strong><span>진행 중 업무</span></div>
          <div class="invite-item"><strong>${selectedTasks.filter(isOverdue).length}건</strong><span>지연 업무</span></div>
        </div>
      </aside>
    </div>

    <section class="card">
      <h2>${escapeHtml(selectedTeam?.name || "팀")} 업무</h2>
      <table class="table">
        <thead><tr><th>업무</th><th>담당자</th><th>상태</th><th>마감</th></tr></thead>
        <tbody>
          ${selectedTasks.slice(0, 16).map((task) => `
            <tr>
              <td>${escapeHtml(task.title)}</td>
              <td>${escapeHtml(profileName(task.assignee_id))}</td>
              <td>${STATUS_LABEL[task.status] || task.status}</td>
              <td>${escapeHtml(task.due_date || "-")}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">진행 중인 업무가 없습니다.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderMemberRows() {
  const profiles = state.profiles.filter((profile) => memberRecord(profile.id));
  if (!profiles.length) return `<tr><td colspan="4">팀원이 없습니다.</td></tr>`;
  return profiles.map((profile) => {
    const member = memberRecord(profile.id);
    return `
      <tr class="context-enabled" data-member-row="${profile.id}">
        <td>
          <span class="member-person">
            ${renderAvatar(profile.id, "small")}
            <strong>${escapeHtml(profile.full_name || profile.email)}</strong>
          </span>
        </td>
        <td>${roleBadge(member.role, true)}</td>
        <td><span class="status-pill ${escapeHtml(member.status)}">${escapeHtml(MEMBER_STATUS_LABEL[member.status] || member.status)}</span></td>
        <td>${escapeHtml(profile.email || "-")}</td>
      </tr>
    `;
  }).join("");
}

function renderNotices() {
  const canWrite = isManager();
  const pageData = noticePageData();
  return `
    ${renderHead("공지", "팀 전체에 공유할 운영 메시지와 배포 안내를 남깁니다.", canWrite ? `<button class="btn primary" data-action="open-form" data-form-kind="notice">공지 작성</button>` : "")}
    <section class="notice-workspace">
      <div class="notice-toolbar">
        <input class="input search-input" data-filter="noticeSearch" placeholder="공지 제목, 내용, 작성자 검색" value="${escapeHtml(state.filters.noticeSearch)}">
        <span class="muted">총 ${pageData.notices.length}개</span>
      </div>
      <div class="notice-list-frame">
        <div class="title-list notice-title-list">
          ${pageData.visible.length ? pageData.visible.map(renderTitleNotice).join("") : `<div class="empty small">조건에 맞는 공지가 없습니다.</div>`}
        </div>
      </div>
      <div class="pagination">
        <button class="btn ghost" data-action="notice-page" data-page="${pageData.page - 1}" ${pageData.page <= 1 ? "disabled" : ""}>이전</button>
        <span>${pageData.page} / ${pageData.totalPages}</span>
        <button class="btn ghost" data-action="notice-page" data-page="${pageData.page + 1}" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>다음</button>
      </div>
    </section>
  `;
}

function renderNoticeCard(notice, compact = false) {
  return `
    <article class="notice ${compact ? "compact" : ""}" data-action="open-notice" data-notice-id="${notice.id}">
      <div class="task-meta">
        ${notice.pinned ? `<span class="pill high">고정</span>` : ""}
        <span class="pill">${escapeHtml(profileName(notice.author_id))}</span>
      </div>
      <h3>${escapeHtml(notice.title)}</h3>
    </article>
  `;
}

function renderNoticeModal() {
  const notice = state.notices.find((item) => item.id === state.activeNoticeId);
  if (!notice) return "";
  const editable = isMine(notice.author_id);
  return `
    <div class="modal-overlay" data-action="close-notice">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="noticeModalTitle">
        <button class="modal-close" type="button" data-action="close-notice" aria-label="닫기">×</button>
        <div class="task-meta">
          ${notice.pinned ? `<span class="pill high">고정</span>` : ""}
          <span class="pill">${escapeHtml(profileName(notice.author_id))}</span>
        </div>
        <h2 id="noticeModalTitle">${escapeHtml(notice.title)}</h2>
        <p class="notice-full">${escapeHtml(notice.body)}</p>
        ${editable ? `<div class="modal-actions"><button class="btn primary" data-action="edit-notice" data-notice-id="${notice.id}">공지 수정</button></div>` : ""}
      </section>
    </div>
  `;
}

function renderTaskModal() {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return "";
  const comments = state.comments.filter((comment) => comment.task_id === task.id);
  const editable = isMine(task.creator_id);
  return `
    <div class="modal-overlay" data-action="close-task">
      <section class="modal-card pop-card" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle">
        <button class="modal-close" type="button" data-action="close-task" aria-label="닫기">×</button>
        <div class="task-meta">
          <span class="pill">${STATUS_LABEL[task.status] || task.status}</span>
          <span class="pill ${task.priority}">${PRIORITY_LABEL[task.priority] || task.priority}</span>
          <span class="pill">담당 ${escapeHtml(profileName(task.assignee_id))}</span>
          ${task.due_date ? `<span class="pill ${isOverdue(task) ? "overdue" : ""}">마감 ${escapeHtml(task.due_date)}</span>` : ""}
        </div>
        <h2 id="taskModalTitle">${escapeHtml(task.title)}</h2>
        <p class="notice-full">${escapeHtml(task.description || "설명이 없습니다.")}</p>
        ${editable ? `<div class="modal-actions"><button class="btn primary" data-action="edit-task" data-task-id="${task.id}">업무 수정</button></div>` : ""}
        <div class="comment-list modal-comments">
          ${comments.length ? comments.map(renderComment).join("") : `<div class="muted">아직 댓글이 없습니다.</div>`}
          <form class="form" data-comment-form="${task.id}">
            <input class="input" name="body" placeholder="댓글을 입력하세요" required>
            <button class="btn">댓글 저장</button>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderFormModal() {
  if (!state.activeForm) return "";
  const isEditingTask = state.activeForm === "task" && state.editingTaskId;
  const isEditingNotice = state.activeForm === "notice" && state.editingNoticeId;
  const title = {
    task: isEditingTask ? "업무 수정" : "새 업무 만들기",
    notice: isEditingNotice ? "공지 수정" : "공지 작성",
    question: "질문 작성",
    directMessage: "메시지 보내기"
  }[state.activeForm];
  return `
    <div class="modal-overlay" data-action="close-form">
      <section class="modal-card pop-card" role="dialog" aria-modal="true" aria-labelledby="formModalTitle">
        <button class="modal-close" type="button" data-action="close-form" aria-label="닫기">×</button>
        <h2 id="formModalTitle">${title}</h2>
        ${renderActiveForm()}
      </section>
    </div>
  `;
}

function renderActiveForm() {
  if (state.activeForm === "task") return renderTaskForm();
  if (state.activeForm === "notice") return renderNoticeForm();
  if (state.activeForm === "question") return renderQuestionForm();
  if (state.activeForm === "directMessage") return renderDirectMessageForm();
  return "";
}

function renderNoticeForm() {
  const editing = state.editingNoticeId ? state.notices.find((notice) => notice.id === state.editingNoticeId) : null;
  const draft = editing || loadDraft("notice");
  return `
    <form class="form" data-notice-form ${editing ? `data-edit-notice-id="${editing.id}"` : `data-draft="notice"`}>
      <input class="input" name="title" placeholder="공지 제목" value="${escapeHtml(draft.title || "")}" required>
      <textarea class="notice-editor" name="body" placeholder="공지 내용 전체를 작성하세요." required>${escapeHtml(draft.body || "")}</textarea>
      <label><input type="checkbox" name="pinned" ${draft.pinned === "on" || draft.pinned === true ? "checked" : ""}> 상단 고정</label>
      <button class="btn primary">${editing ? "공지 수정" : "공지 저장"}</button>
    </form>
  `;
}

function renderQuestionForm() {
  const draft = loadDraft("question");
  return `
    <form class="form" data-question-form data-draft="question">
      <input class="input" name="title" placeholder="질문 제목" value="${escapeHtml(draft.title || "")}" required>
      <textarea name="body" placeholder="질문 내용을 적어주세요" required>${escapeHtml(draft.body || "")}</textarea>
      <button class="btn primary">질문 등록</button>
    </form>
  `;
}

function renderDirectMessageForm() {
  const target = state.profiles.find((profile) => profile.id === state.activeMessageTargetId);
  const draft = loadDraft(`direct:${state.activeMessageTargetId || "member"}`);
  return `
    <form class="form" data-direct-message-form data-draft="direct:${escapeHtml(state.activeMessageTargetId || "member")}">
      <p class="muted">${escapeHtml(target?.full_name || target?.email || "팀원")}에게 개인 메시지를 보냅니다.</p>
      <textarea name="body" placeholder="메시지를 입력하세요" required>${escapeHtml(draft.body || "")}</textarea>
      <button class="btn primary">메시지 전송</button>
    </form>
  `;
}

function renderProfileEditModal() {
  if (!state.profileEditOpen) return "";
  const profile = currentProfile();
  return `
    <div class="modal-overlay" data-action="close-profile-edit">
      <section class="modal-card pop-card profile-edit-card" role="dialog" aria-modal="true" aria-labelledby="profileEditTitle">
        <button class="modal-close" type="button" data-action="close-profile-edit" aria-label="닫기">×</button>
        <div class="profile-edit-head">
          ${renderAvatar(state.user.id, "large")}
          <div>
            <h2 id="profileEditTitle">내 정보 수정</h2>
            <p class="muted">${escapeHtml(profile.email || state.user.email || "-")}</p>
          </div>
        </div>
        <form class="profile-edit-form" data-profile-edit-form>
          <div class="settings-list edit-list">
            <label class="settings-row editable">
              <span class="settings-label">이름</span>
              <input class="settings-input" name="full_name" value="${escapeHtml(profile.full_name || "")}" required>
            </label>
            <label class="settings-row editable">
              <span class="settings-label">이메일</span>
              <input class="settings-input" type="email" name="email" value="${escapeHtml(profile.email || state.user.email || "")}" required>
            </label>
            <label class="settings-row editable">
              <span class="settings-label">프로필 이미지</span>
              <input class="settings-input" name="avatar_url" placeholder="https://..." value="${escapeHtml(profile.avatar_url || "")}">
            </label>
          </div>
          <div class="settings-list locked-list">
            <div class="settings-row locked">
              <span class="settings-label">팀 역할</span>
              <span class="settings-value">${escapeHtml(ROLE_LABEL[state.role] || state.role)}</span>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-action="cancel-profile-edit">취소</button>
            <button class="btn primary">저장</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderMemberActionMenu() {
  if (!state.memberMenu) return "";
  const profile = state.profiles.find((item) => item.id === state.memberMenu.userId);
  const canManage = canManageMember(state.memberMenu.userId);
  return `
    <div class="context-backdrop" data-action="close-member-menu">
      <div class="member-context-menu" style="left:${state.memberMenu.x}px; top:${state.memberMenu.y}px" role="menu">
        <strong>${escapeHtml(profile?.full_name || profile?.email || "팀원")}</strong>
        <button type="button" data-action="message-member" ${state.memberMenu.userId === state.user.id ? "disabled" : ""}>메시지 보내기</button>
        ${canManage ? `
          <button type="button" data-action="edit-member">직급/상태 수정</button>
          <button type="button" class="danger-text" data-action="remove-member">팀 추방</button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderMemberEditModal() {
  if (!state.activeMemberId || !canManageMember(state.activeMemberId)) return "";
  const profile = state.profiles.find((item) => item.id === state.activeMemberId);
  const member = memberRecord(state.activeMemberId);
  if (!profile || !member) return "";
  const editableRoles = assignableRoles();
  return `
    <div class="modal-overlay" data-action="close-member-edit">
      <section class="modal-card pop-card" role="dialog" aria-modal="true" aria-labelledby="memberEditTitle">
        <button class="modal-close" type="button" data-action="close-member-edit" aria-label="닫기">×</button>
        <h2 id="memberEditTitle">${escapeHtml(profile.full_name || profile.email)}</h2>
        <form class="form" data-member-edit-form data-member-id="${profile.id}">
          <select name="role">
            ${editableRoles.map((role) => option(role, ROLE_LABEL[role], member.role)).join("")}
          </select>
          <select name="status">
            ${Object.entries(MEMBER_STATUS_LABEL).map(([value, label]) => option(value, label, member.status)).join("")}
          </select>
          <button class="btn primary">팀원 정보 저장</button>
        </form>
      </section>
    </div>
  `;
}

function renderQuestions() {
  return `
    ${renderHead("질문", "업무 진행 중 생긴 질문을 남기고, 매니저가 답변합니다.", `<button class="btn primary" data-action="open-form" data-form-kind="question">질문 작성</button>`)}
    <section class="list">
      ${state.questions.length ? state.questions.map(renderQuestionCard).join("") : `<div class="empty">아직 질문이 없습니다.</div>`}
    </section>
  `;
}

function renderQuestionCard(question) {
  const replies = question.replies || [];
  return `
    <article class="task-card">
      <div class="task-top">
        <div>
          <h2 class="task-title">${escapeHtml(question.title)}</h2>
          <p class="task-desc">${escapeHtml(question.body)}</p>
        </div>
        <span class="pill ${question.status === "answered" ? "low" : "normal"}">${question.status === "answered" ? "답변완료" : "답변대기"}</span>
      </div>
      <div class="task-meta">
        <span class="pill">${escapeHtml(profileName(question.author_id))}</span>
      </div>
      <div class="comment-list">
        ${replies.length ? replies.map(renderInlineReply).join("") : `<div class="muted">아직 답변이 없습니다.</div>`}
        <form class="form ${isManager() ? "" : "hidden"}" data-question-reply-form="${question.id}">
          <input class="input" name="body" placeholder="답변을 입력하세요" required>
          <button class="btn">답변 저장</button>
        </form>
      </div>
    </article>
  `;
}

function renderMessages() {
  const messages = sortedMessages();
  const activeMessage = messages.find((message) => message.id === state.activeMessageId);
  return `
    ${renderHead("메시지", "팀 대화와 개인 대화를 확인합니다. 개인 메시지는 팀원 우클릭으로 시작합니다.")}
    <section class="message-shell">
      <div class="message-list-panel">
        <div class="message-tabs" aria-label="메시지 유형">
          <button class="${state.messageScope === "team" ? "active" : ""}" data-message-scope="team">팀 메시지</button>
          <button class="${state.messageScope === "private" ? "active" : ""}" data-message-scope="private">개인 메시지</button>
        </div>
        <div class="message-list">
          ${messages.length ? messages.map(renderMessageRow).join("") : `<div class="empty small">표시할 메시지가 없습니다.</div>`}
        </div>
      </div>
      <div class="message-detail-panel">
        ${activeMessage ? renderMessageDetail(activeMessage) : renderMessageEmpty()}
      </div>
    </section>
  `;
}

function renderMessageRow(message) {
  const latest = latestMessage(message);
  const unread = unreadMessages(message).length > 0;
  const name = messagePeerName(message);
  const badge = unreadMessageLabel(message);
  const latestText = latest?.body || message.body;
  return `
    <button class="message-row ${unread ? "unread" : ""} ${state.activeMessageId === message.id ? "active" : ""}" data-action="open-message" data-message-id="${message.id}">
      ${message.is_private ? renderAvatarWithRole(message.peer_id) : renderTeamAvatar()}
      <span class="message-row-main">
        <span class="message-row-name">${escapeHtml(name)}</span>
        <span class="message-row-preview">${escapeHtml(latestText)}</span>
      </span>
      <span class="message-row-side">
        ${badge ? `<span class="message-count">${escapeHtml(badge)}</span>` : ""}
        ${unread ? `<span class="unread-dot" aria-label="읽지 않은 메시지"></span>` : ""}
      </span>
    </button>
  `;
}

function renderMessageDetail(message) {
  const title = message.is_private ? messagePeerName(message) : "팀 메시지";
  return `
    <article class="message-thread">
      <div class="message-thread-head">
        ${message.is_private ? renderAvatarWithRole(message.peer_id) : renderTeamAvatar()}
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${message.is_private ? "개인 메시지" : escapeHtml(state.workspace?.name || "팀")}</p>
        </div>
      </div>
      <div class="chat-stream">
        ${conversationThread(message).map((item) => renderChatBubble(item, message.is_private)).join("") || `<div class="empty small">아직 메시지가 없습니다.</div>`}
      </div>
      <form class="chat-reply" data-conversation-reply-form="${message.id}" data-recipient-id="${escapeHtml(message.peer_id || "")}" data-message-scope="${message.is_private ? "private" : "team"}">
        <input class="input" name="body" placeholder="답장을 입력하세요" required>
        <button class="btn primary">전송</button>
      </form>
    </article>
  `;
}

function renderChatBubble(item, isPrivate = false) {
  const mine = item.author_id === state.user?.id;
  return `
    <div class="chat-line ${mine ? "mine" : "theirs"}">
      ${renderAvatarWithRole(item.author_id, "small")}
      <div class="chat-bubble">
        <strong class="chat-author">
          <span>${escapeHtml(profileName(item.author_id))}</span>
        </strong>
        <span>${escapeHtml(item.body)}</span>
      </div>
    </div>
  `;
}

function renderMessageEmpty() {
  return `
    <div class="message-empty">
      ${renderAvatar(state.user?.id, "large", "나")}
      <h2>대화를 선택하세요</h2>
      <p>왼쪽 목록에서 사람 또는 팀 메시지를 누르면 전체 대화가 열립니다.</p>
    </div>
  `;
}

function renderInlineReply(reply) {
  return `
    <div class="comment">
      <strong>${escapeHtml(profileName(reply.author_id))}</strong>
      <span>${escapeHtml(reply.body)}</span>
    </div>
  `;
}

function renderProfile() {
  const profile = currentProfile();
  const member = memberRecord(state.user.id);
  const email = profile.email || state.user.email || "-";
  const roleLabel = ROLE_LABEL[state.role] || state.role;
  const statusLabel = MEMBER_STATUS_LABEL[member?.status] || member?.status || "-";
  const memberships = userMemberships();
  return `
    ${renderHead("내 정보", "계정 정보와 현재 팀 권한을 확인합니다.")}
    <section class="profile-page">
      <div class="profile-hero">
        <div class="profile-identity">
          ${renderAvatar(state.user.id, "large")}
          <div>
            <h2>${escapeHtml(profile.full_name || email)}</h2>
            <p>${escapeHtml(email)}</p>
          </div>
        </div>
        <button class="btn primary" data-action="open-profile-edit">수정</button>
      </div>

      <section class="settings-section">
        <h2>계정</h2>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-label">이름</span>
            <span class="settings-value">${escapeHtml(profile.full_name || "-")}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">이메일</span>
            <span class="settings-value">${escapeHtml(email)}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">프로필 이미지</span>
            <span class="settings-value">${profile.avatar_url ? "설정됨" : "기본 아바타"}</span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2>팀</h2>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-label">역할</span>
            <span class="settings-value with-badge">${roleBadge(state.role)}${escapeHtml(roleLabel)}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">상태</span>
            <span class="settings-value"><span class="status-pill ${escapeHtml(member?.status || "disabled")}">${escapeHtml(statusLabel)}</span></span>
          </div>
          <div class="settings-row">
            <span class="settings-label">팀</span>
            <span class="settings-value">${escapeHtml(state.workspace?.name || "-")}</span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2>소속 팀</h2>
        <div class="settings-list team-membership-list">
          ${memberships.length ? memberships.map((membership) => `
            <div class="settings-row team-membership-row">
              <span class="settings-label">${escapeHtml(workspaceName(membership.workspace_id))}</span>
              <span class="settings-value membership-value">
                ${roleBadge(membership.role)}
                <span>${escapeHtml(ROLE_LABEL[membership.role] || membership.role)}</span>
                <span class="status-pill ${escapeHtml(membership.status)}">${escapeHtml(MEMBER_STATUS_LABEL[membership.status] || membership.status)}</span>
              </span>
            </div>
          `).join("") : `
            <div class="settings-row">
              <span class="settings-label">소속</span>
              <span class="settings-value">참여 중인 팀이 없습니다.</span>
            </div>
          `}
        </div>
      </section>

      <section class="settings-section">
        <h2>저장</h2>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-label">저장 방식</span>
            <span class="settings-value">${state.mode === "live" ? "Supabase DB" : "브라우저 데모 저장"}</span>
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderAuth() {
  applyTheme();
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="brand">
          <div class="brand-mark">W</div>
          <span><strong>Work To Do</strong><span>${HAS_SUPABASE ? "Supabase DB 연결 준비됨" : "데모 모드로 미리보기"}</span></span>
        </div>
        <h1>팀 업무를 사람별로 나누고 함께 끝내세요.</h1>
        <p>각 사용자는 다른 ID/PW로 로그인하고, 본인 업무와 팀 업무를 분리해서 봅니다. Supabase 환경변수를 넣으면 실제 DB/Auth 기반으로 저장됩니다.</p>
        <form class="form" data-auth-form>
          <input class="input" name="full_name" placeholder="이름 또는 닉네임">
          <input class="input" name="email" type="email" placeholder="이메일" value="${HAS_SUPABASE ? "" : "admin@worktodo.local"}" required>
          <input class="input" name="password" type="password" placeholder="비밀번호" value="${HAS_SUPABASE ? "" : "admin123"}" required>
          <div class="form-row">
            <button class="btn primary" name="intent" value="signin">로그인</button>
            <button class="btn" name="intent" value="signup">회원가입</button>
          </div>
        </form>
        ${HAS_SUPABASE ? `<p class="muted">회원가입 후 이메일 확인 설정에 따라 바로 로그인되지 않을 수 있습니다.</p>` : renderDemoAccounts()}
      </section>
    </main>
  `;
  bindAuthEvents();
}

function renderDemoAccounts() {
  return `
    <div class="demo-account-panel">
      <span class="demo-account-title">데모 계정</span>
      <div class="demo-account-list">
        ${DEMO_ACCOUNT_HINTS.map((account) => `
          <button type="button" class="demo-account" data-demo-email="${account.email}" data-demo-password="${account.password}">
            ${roleBadge(account.role)}
            <span>
              <strong>${escapeHtml(account.name)}</strong>
              <small>${escapeHtml(account.email)} / ${escapeHtml(account.password)}</small>
            </span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (button.dataset.taskScope) state.taskScope = button.dataset.taskScope;
      state.workspaceMenuOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-task-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskScope = button.dataset.taskScope;
      state.view = "tasks";
      render();
    });
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await api.signOut();
    state.user = null;
    renderAuth();
  });

  document.querySelector("[data-action='toggle-theme']")?.addEventListener("click", toggleTheme);

  document.querySelector("[data-action='toggle-workspace-menu']")?.addEventListener("click", () => {
    state.workspaceMenuOpen = !state.workspaceMenuOpen;
    if (!state.workspaceMenuOpen) state.creatingWorkspaceFromMenu = false;
    render();
  });

  document.querySelector("[data-action='show-workspace-create']")?.addEventListener("click", () => {
    state.creatingWorkspaceFromMenu = true;
    render();
  });

  document.querySelectorAll("[data-workspace-choice]").forEach((button) => {
    button.addEventListener("click", async () => {
    try {
      await api.setWorkspace(button.dataset.workspaceChoice);
      state.view = "home";
      state.activeNoticeId = null;
      state.activeMessageId = null;
      state.workspaceMenuOpen = false;
      state.creatingWorkspaceFromMenu = false;
      await refreshData();
      render();
      toast("팀을 전환했습니다.");
    } catch (error) {
      toast(error.message || "팀 전환에 실패했습니다.");
    }
    });
  });

  document.querySelectorAll("[data-admin-workspace-choice]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
      await api.setWorkspace(button.dataset.adminWorkspaceChoice);
      state.adminWorkspaceId = button.dataset.adminWorkspaceChoice;
      state.workspaceMenuOpen = false;
      state.creatingWorkspaceFromMenu = false;
      await refreshData();
        state.view = "dashboard";
        render();
      } catch (error) {
        toast(error.message || "팀 정보를 불러오지 못했습니다.");
      }
    });
  });

  document.querySelectorAll("[data-action='open-form']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeForm = button.dataset.formKind;
      state.editingTaskId = null;
      state.editingNoticeId = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='edit-task']").forEach((button) => {
    button.addEventListener("click", () => {
      const task = state.tasks.find((item) => item.id === button.dataset.taskId);
      if (!task || !isMine(task.creator_id)) return;
      state.activeTaskId = null;
      state.activeForm = "task";
      state.editingTaskId = task.id;
      render();
    });
  });

  document.querySelectorAll("[data-action='edit-notice']").forEach((button) => {
    button.addEventListener("click", () => {
      const notice = state.notices.find((item) => item.id === button.dataset.noticeId);
      if (!notice || !isMine(notice.author_id)) return;
      state.activeNoticeId = null;
      state.activeForm = "notice";
      state.editingNoticeId = notice.id;
      render();
    });
  });

  document.querySelectorAll("[data-action='open-notice']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeNoticeId = button.dataset.noticeId;
      render();
    });
  });

  document.querySelectorAll("[data-action='open-task']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTaskId = button.dataset.taskId;
      render();
    });
  });

  document.querySelectorAll("[data-message-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.messageScope = button.dataset.messageScope;
      state.activeMessageId = null;
      render();
    });
  });

  document.querySelector(".message-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='open-message']");
    if (!button) return;
    const conversation = sortedMessages().find((message) => message.id === button.dataset.messageId);
    const unread = unreadMessages(conversation || {});
    const unreadIds = unread.map((message) => message.id);
    state.activeMessageId = button.dataset.messageId;
    state.messages = state.messages.map((message) => unreadIds.includes(message.id)
      ? { ...message, read_by: Array.from(new Set([...(message.read_by || []), state.user.id])) }
      : message);
    render();
    try {
      await Promise.all(unreadIds.map((id) => api.markMessageRead?.(id)));
      await refreshData();
      state.activeMessageId = button.dataset.messageId;
      render();
    } catch (error) {
      toast(error.message || "읽음 처리에 실패했습니다.");
    }
  });

  document.querySelectorAll("[data-action='close-notice']").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".modal-card") && !event.target.closest(".modal-close")) return;
      state.activeNoticeId = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='close-task']").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".modal-card") && !event.target.closest(".modal-close")) return;
      state.activeTaskId = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='close-form']").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".modal-card") && !event.target.closest(".modal-close")) return;
      state.activeForm = null;
      state.editingTaskId = null;
      state.editingNoticeId = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='close-profile-edit']").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".modal-card") && !event.target.closest(".modal-close")) return;
      state.profileEditOpen = false;
      render();
    });
  });

  document.querySelector("[data-action='cancel-profile-edit']")?.addEventListener("click", () => {
    state.profileEditOpen = false;
    render();
  });

  document.querySelector("[data-action='open-profile-edit']")?.addEventListener("click", () => {
    state.profileEditOpen = true;
    render();
  });

  document.querySelector("[data-profile-edit-form]")?.addEventListener("submit", handleProfileEditSubmit);

  document.querySelectorAll("[data-member-row]").forEach((row) => {
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.memberMenu = {
        userId: row.dataset.memberRow,
        x: Math.min(event.clientX, window.innerWidth - 220),
        y: Math.min(event.clientY, window.innerHeight - 150)
      };
      render();
    });
  });

  document.querySelector("[data-action='close-member-menu']")?.addEventListener("click", () => {
    state.memberMenu = null;
    render();
  });

  document.querySelector("[data-action='edit-member']")?.addEventListener("click", () => {
    state.activeMemberId = state.memberMenu?.userId || null;
    if (!canManageMember(state.activeMemberId)) return;
    state.memberMenu = null;
    render();
  });

  document.querySelector("[data-action='message-member']")?.addEventListener("click", () => {
    const userId = state.memberMenu?.userId;
    if (!userId || userId === state.user.id) return;
    state.activeMessageTargetId = userId;
    state.activeForm = "directMessage";
    state.memberMenu = null;
    render();
  });

  document.querySelector("[data-action='remove-member']")?.addEventListener("click", async () => {
    const userId = state.memberMenu?.userId;
    if (!canManageMember(userId)) return;
    try {
      await api.removeMember(userId);
      state.memberMenu = null;
      await refreshData();
      render();
      toast("팀에서 내보냈습니다.");
    } catch (error) {
      toast(error.message || "팀원 추방에 실패했습니다.");
    }
  });

  document.querySelectorAll("[data-action='close-member-edit']").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".modal-card") && !event.target.closest(".modal-close")) return;
      state.activeMemberId = null;
      render();
    });
  });

  document.querySelector("[data-member-edit-form]")?.addEventListener("submit", handleMemberEditSubmit);
  document.querySelector("[data-create-workspace-form]")?.addEventListener("submit", handleCreateWorkspaceSubmit);
  document.querySelector("[data-invite-form]")?.addEventListener("submit", handleInviteSubmit);
  document.querySelector("[data-action='copy-invite']")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      toast("초대 주소를 복사했습니다.");
    } catch {
      toast(inviteLink());
    }
  });

  document.querySelectorAll("[data-filter]").forEach((field) => {
    field.addEventListener("input", () => {
      state.filters[field.dataset.filter] = field.value;
      if (field.dataset.filter === "noticeSearch") state.filters.noticePage = 1;
      render();
    });
  });

  document.querySelectorAll("[data-action='notice-page']").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.noticePage = Number(button.dataset.page) || 1;
      render();
    });
  });

  document.querySelector("[data-task-form]")?.addEventListener("submit", handleTaskSubmit);
  document.querySelector("[data-notice-form]")?.addEventListener("submit", handleNoticeSubmit);
  document.querySelector("[data-question-form]")?.addEventListener("submit", handleQuestionSubmit);
  document.querySelector("[data-direct-message-form]")?.addEventListener("submit", handleDirectMessageSubmit);

  document.querySelectorAll("[data-draft]").forEach((form) => {
    form.addEventListener("input", () => saveDraft(form.dataset.draft, form));
    form.addEventListener("change", () => saveDraft(form.dataset.draft, form));
  });

  document.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await api.updateTask(select.dataset.taskStatus, { status: select.value });
        await refreshData();
        render();
        toast("업무 상태를 변경했습니다.");
      } catch (error) {
        toast(error.message || "상태 변경에 실패했습니다.");
      }
    });
  });

  document.querySelectorAll("[data-action='toggle-comments']").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(`[data-comments="${button.dataset.taskId}"]`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", handleCommentSubmit);
  });

  document.querySelectorAll("[data-question-reply-form]").forEach((form) => {
    form.addEventListener("submit", handleQuestionReplySubmit);
  });

  document.querySelectorAll("[data-message-reply-form]").forEach((form) => {
    form.addEventListener("submit", handleMessageReplySubmit);
  });

  document.querySelectorAll("[data-conversation-reply-form]").forEach((form) => {
    form.addEventListener("submit", handleConversationReplySubmit);
  });
}

function bindNoWorkspaceEvents() {
  document.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await api.signOut();
    state.user = null;
    state.noWorkspace = false;
    renderAuth();
  });

  document.querySelector("[data-create-workspace-form]")?.addEventListener("submit", handleCreateWorkspaceSubmit);
  document.querySelector("[data-join-workspace-form]")?.addEventListener("submit", handleJoinWorkspaceSubmit);
}

function bindAuthEvents() {
  document.querySelectorAll("[data-demo-email]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector("[data-auth-form]");
      if (!form) return;
      form.elements.email.value = button.dataset.demoEmail || "";
      form.elements.password.value = button.dataset.demoPassword || "";
      form.elements.full_name.value = "";
    });
  });

  document.querySelector("[data-auth-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const form = new FormData(event.currentTarget);
    const email = form.get("email")?.toString().trim();
    const password = form.get("password")?.toString();
    const fullName = form.get("full_name")?.toString().trim();
    try {
      state.user = submitter?.value === "signup"
        ? await api.signUp(email, password, fullName)
        : await api.signIn(email, password);
      await refreshData();
      render();
      toast("로그인되었습니다.");
    } catch (error) {
      toast(error.message || "로그인에 실패했습니다.");
    }
  });
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const task = {
    title: form.get("title")?.toString().trim(),
    description: form.get("description")?.toString().trim(),
    assignee_id: form.get("assignee_id")?.toString(),
    priority: form.get("priority")?.toString(),
    status: form.get("status")?.toString(),
    due_date: form.get("due_date")?.toString() || null,
    project_id: form.get("project_id")?.toString() || null,
    visibility: "team"
  };
  try {
    const editId = event.currentTarget.dataset.editTaskId;
    const editing = editId ? state.tasks.find((item) => item.id === editId) : null;
    if (editing) {
      if (!isMine(editing.creator_id)) return;
      await api.updateTask(editId, task);
      state.editingTaskId = null;
    } else {
      await api.createTask(task);
      clearDraft("task");
    }
    state.activeForm = null;
    await refreshData();
    render();
    toast(editing ? "업무를 수정했습니다." : "업무를 만들었습니다.");
  } catch (error) {
    toast(error.message || "업무 저장에 실패했습니다.");
  }
}

async function handleCommentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = form.get("body")?.toString().trim();
  if (!body) return;
  try {
    await api.addComment(event.currentTarget.dataset.commentForm, body);
    await refreshData();
    render();
    toast("댓글을 저장했습니다.");
  } catch (error) {
    toast(error.message || "댓글 저장에 실패했습니다.");
  }
}

async function handleNoticeSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const notice = {
    title: form.get("title")?.toString().trim(),
    body: form.get("body")?.toString().trim(),
    pinned: form.get("pinned") === "on",
    importance: form.get("pinned") === "on" ? "important" : "normal"
  };
  try {
    const editId = event.currentTarget.dataset.editNoticeId;
    const editing = editId ? state.notices.find((item) => item.id === editId) : null;
    if (editing) {
      if (!isMine(editing.author_id)) return;
      await api.updateNotice(editId, notice);
      state.editingNoticeId = null;
    } else {
      await api.createNotice(notice);
      clearDraft("notice");
    }
    state.activeForm = null;
    await refreshData();
    render();
    toast(editing ? "공지를 수정했습니다." : "공지를 저장했습니다.");
  } catch (error) {
    toast(error.message || "공지 저장에 실패했습니다.");
  }
}

async function handleQuestionSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.createQuestion({
      title: form.get("title")?.toString().trim(),
      body: form.get("body")?.toString().trim()
    });
    clearDraft("question");
    state.activeForm = null;
    await refreshData();
    render();
    toast("질문을 등록했습니다.");
  } catch (error) {
    toast(error.message || "질문 등록에 실패했습니다.");
  }
}

async function handleQuestionReplySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.replyQuestion(event.currentTarget.dataset.questionReplyForm, form.get("body")?.toString().trim());
    await refreshData();
    render();
    toast("답변을 저장했습니다.");
  } catch (error) {
    toast(error.message || "답변 저장에 실패했습니다.");
  }
}

async function handleDirectMessageSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const recipientId = state.activeMessageTargetId;
  if (!recipientId) return;
  try {
    await api.createMessage({
      body: form.get("body")?.toString().trim(),
      is_private: true,
      recipient_id: recipientId
    });
    clearDraft(`direct:${recipientId}`);
    state.activeForm = null;
    state.activeMessageTargetId = null;
    state.messageScope = "private";
    await refreshData();
    state.activeMessageId = `private:${recipientId}`;
    state.view = "messages";
    render();
    toast("메시지를 보냈습니다.");
  } catch (error) {
    toast(error.message || "메시지 저장에 실패했습니다.");
  }
}

async function handleMessageReplySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.replyMessage(event.currentTarget.dataset.messageReplyForm, form.get("body")?.toString().trim());
    await refreshData();
    render();
    toast("답장을 저장했습니다.");
  } catch (error) {
    toast(error.message || "답장 저장에 실패했습니다.");
  }
}

async function handleConversationReplySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = form.get("body")?.toString().trim();
  if (!body) return;
  const scope = event.currentTarget.dataset.messageScope;
  const recipientId = event.currentTarget.dataset.recipientId;
  try {
    await api.createMessage({
      body,
      is_private: scope === "private",
      recipient_id: scope === "private" ? recipientId : null
    });
    await refreshData();
    state.activeMessageId = event.currentTarget.dataset.conversationReplyForm;
    render();
    toast("메시지를 보냈습니다.");
  } catch (error) {
    toast(error.message || "메시지 전송에 실패했습니다.");
  }
}

async function handleCreateWorkspaceSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = form.get("name")?.toString().trim();
  if (!name) return;
  try {
    await api.createWorkspace(name);
    await refreshData();
    state.view = "home";
    state.workspaceMenuOpen = false;
    state.creatingWorkspaceFromMenu = false;
    render();
    toast("새 팀을 만들었습니다.");
  } catch (error) {
    toast(error.message || "팀 생성에 실패했습니다.");
  }
}

async function handleJoinWorkspaceSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = form.get("code")?.toString().trim();
  if (!code) return;
  try {
    await api.joinWorkspaceByCode(code);
    await refreshData();
    state.view = "home";
    render();
    toast("팀에 참여했습니다.");
  } catch (error) {
    toast(error.message || "팀 참여에 실패했습니다.");
  }
}

async function handleInviteSubmit(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const form = new FormData(event.currentTarget);
  try {
    await api.createInvite({
      email: form.get("email")?.toString().trim(),
      role: form.get("role")?.toString() || "member"
    });
    await refreshData();
    render();
    toast("초대를 만들었습니다.");
  } catch (error) {
    toast(error.message || "초대 생성에 실패했습니다.");
  }
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.updateProfile({
      full_name: form.get("full_name")?.toString().trim(),
      email: form.get("email")?.toString().trim(),
      avatar_url: form.get("avatar_url")?.toString().trim()
    });
    state.profileEditOpen = false;
    await refreshData();
    render();
    toast("내 정보를 수정했습니다.");
  } catch (error) {
    toast(error.message || "내 정보 수정에 실패했습니다.");
  }
}

async function handleMemberEditSubmit(event) {
  event.preventDefault();
  if (!canManageMember(event.currentTarget.dataset.memberId)) return;
  const form = new FormData(event.currentTarget);
  try {
    await api.updateMember(event.currentTarget.dataset.memberId, {
      role: form.get("role")?.toString(),
      status: form.get("status")?.toString()
    });
    state.activeMemberId = null;
    await refreshData();
    render();
    toast("팀원 정보를 수정했습니다.");
  } catch (error) {
    toast(error.message || "팀원 정보 수정에 실패했습니다.");
  }
}

boot();
