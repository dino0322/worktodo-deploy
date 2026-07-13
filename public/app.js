const CONFIG = window.WORKTODO_CONFIG || {};
const HAS_SUPABASE = Boolean(
  CONFIG.supabaseUrl &&
  CONFIG.supabaseAnonKey &&
  window.supabase?.createClient
);

const supabaseClient = HAS_SUPABASE
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
  : null;

const STORE_KEY = "worktodoDemoV1";
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
  member: "팀원",
  manager: "매니저",
  admin: "관리자",
  guest: "게스트"
};

let state = {
  mode: HAS_SUPABASE ? "live" : "demo",
  user: null,
  workspace: null,
  role: "member",
  profiles: [],
  projects: [],
  tasks: [],
  comments: [],
  notices: [],
  view: "mine",
  filters: {
    search: "",
    status: "all",
    assignee: "all",
    priority: "all"
  }
};

const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.setTimeout(() => toastEl.classList.remove("show"), 2400);
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
    full_name: state.user?.name || state.user?.email || "사용자"
  };
}

function profileName(id) {
  const profile = state.profiles.find((item) => item.id === id);
  return profile?.full_name || profile?.email || "미지정";
}

function readDemo() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORE_KEY);
    }
  }
  const adminId = "demo-admin";
  const minjiId = "demo-minji";
  const hyunId = "demo-hyun";
  const workspaceId = "demo-workspace";
  const projectOps = "project-ops";
  const projectLaunch = "project-launch";
  return {
    sessionUserId: adminId,
    users: [
      { id: adminId, email: "admin@worktodo.local", password: "admin123", full_name: "손팀장" },
      { id: minjiId, email: "minji@worktodo.local", password: "member123", full_name: "강민지" },
      { id: hyunId, email: "hyun@worktodo.local", password: "member123", full_name: "이현우" }
    ],
    workspace: { id: workspaceId, name: "Work To Do 팀" },
    members: [
      { workspace_id: workspaceId, user_id: adminId, role: "admin", status: "active" },
      { workspace_id: workspaceId, user_id: minjiId, role: "member", status: "active" },
      { workspace_id: workspaceId, user_id: hyunId, role: "manager", status: "active" }
    ],
    projects: [
      { id: projectOps, workspace_id: workspaceId, name: "운영", color: "#2563eb" },
      { id: projectLaunch, workspace_id: workspaceId, name: "배포", color: "#0f766e" }
    ],
    tasks: [
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
    notices: [
      {
        id: uid(),
        workspace_id: workspaceId,
        author_id: adminId,
        title: "이번 주 목표",
        body: "업무 흐름은 먼저 간단하게 열고, DB 연결과 배포 안정성을 우선 확인합니다.",
        pinned: true,
        importance: "important",
        created_at: new Date().toISOString()
      }
    ]
  };
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
      data.members.push({ workspace_id: data.workspace.id, user_id: user.id, role: "member", status: "active" });
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
      const user = data.users.find((item) => item.id === data.sessionUserId);
      const member = data.members.find((item) => item.user_id === user?.id);
      return {
        workspace: data.workspace,
        role: member?.role || "member",
        profiles: data.users.map(({ id, email, full_name }) => ({ id, email, full_name })),
        projects: data.projects,
        tasks: data.tasks,
        comments: data.comments,
        notices: data.notices
      };
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
      const record = {
        ...notice,
        id: uid(),
        workspace_id: data.workspace.id,
        author_id: data.sessionUserId,
        created_at: new Date().toISOString()
      };
      data.notices.unshift(record);
      writeDemo(data);
      return record;
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
      await supabaseClient.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: user.name || user.email
      });

      let { data: memberships, error: memberError } = await supabaseClient
        .from("workspace_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (memberError) throw memberError;

      let workspace;
      let role = memberships?.[0]?.role || "admin";

      if (!memberships?.length) {
        const { data: createdWorkspace, error: workspaceError } = await supabaseClient
          .from("workspaces")
          .insert({ name: "Work To Do 팀", owner_id: user.id })
          .select("*")
          .single();
        if (workspaceError) throw workspaceError;
        workspace = createdWorkspace;
        const { error: insertMemberError } = await supabaseClient
          .from("workspace_members")
          .insert({ workspace_id: workspace.id, user_id: user.id, role: "admin", status: "active" });
        if (insertMemberError) throw insertMemberError;
        role = "admin";
      } else {
        const { data: workspaceData, error: workspaceFetchError } = await supabaseClient
          .from("workspaces")
          .select("*")
          .eq("id", memberships[0].workspace_id)
          .single();
        if (workspaceFetchError) throw workspaceFetchError;
        workspace = workspaceData;
      }

      const [
        membersResult,
        projectsResult,
        tasksResult,
        commentsResult,
        noticesResult
      ] = await Promise.all([
        supabaseClient.from("workspace_members").select("*").eq("workspace_id", workspace.id).eq("status", "active"),
        supabaseClient.from("projects").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: true }),
        supabaseClient.from("tasks").select("*").eq("workspace_id", workspace.id).is("archived_at", null).order("created_at", { ascending: false }),
        supabaseClient.from("task_comments").select("*").order("created_at", { ascending: true }),
        supabaseClient.from("notices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
      ]);

      for (const result of [membersResult, projectsResult, tasksResult, commentsResult, noticesResult]) {
        if (result.error) throw result.error;
      }

      const memberIds = membersResult.data.map((item) => item.user_id);
      const { data: profiles, error: profilesError } = await supabaseClient
        .from("profiles")
        .select("*")
        .in("id", memberIds.length ? memberIds : [user.id]);
      if (profilesError) throw profilesError;

      return {
        workspace,
        role,
        profiles: profiles || [],
        projects: projectsResult.data || [],
        tasks: tasksResult.data || [],
        comments: commentsResult.data || [],
        notices: noticesResult.data || []
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

function stats() {
  const myTasks = state.tasks.filter((task) => task.assignee_id === state.user?.id || task.creator_id === state.user?.id);
  return {
    mine: myTasks.filter((task) => task.status !== "done").length,
    dueToday: state.tasks.filter((task) => task.due_date === today() && task.status !== "done").length,
    overdue: state.tasks.filter(isOverdue).length,
    review: state.tasks.filter((task) => task.status === "review").length
  };
}

function render() {
  if (!state.user) {
    renderAuth();
    return;
  }
  const profile = currentProfile();
  const isManager = ["admin", "manager"].includes(state.role);
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">W</div>
          <span><strong>Work To Do</strong><span>팀 업무와 개인 할 일을 한 곳에서</span></span>
        </div>
        <div class="top-actions">
          <span class="workspace-chip">${escapeHtml(state.workspace?.name || "워크스페이스")}</span>
          <span class="role-chip">${escapeHtml(profile.full_name || profile.email)} · ${ROLE_LABEL[state.role] || state.role}</span>
          <span class="mode-chip ${state.mode === "live" ? "live" : ""}">${state.mode === "live" ? "DB 연결됨" : "데모 모드"}</span>
          <button class="btn ghost" data-action="logout">로그아웃</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          ${navButton("mine", "내 업무")}
          ${navButton("team", "팀 업무")}
          ${navButton("board", "보드")}
          ${navButton("dashboard", "대시보드", !isManager)}
          ${navButton("notices", "공지")}
          <div class="side-panel">
            <h3>빠른 안내</h3>
            <p>${state.mode === "live"
              ? "현재 Supabase DB에 연결되어 있습니다. 업무와 공지가 서버에 저장됩니다."
              : "Supabase 환경변수를 넣으면 같은 화면이 실제 DB 기반으로 전환됩니다."}</p>
          </div>
        </aside>
        <main class="main">
          ${renderPage()}
        </main>
      </div>
    </div>
  `;
  bindEvents();
}

function navButton(view, label, hidden = false) {
  return `<button class="nav-button ${state.view === view ? "active" : ""}" data-view="${view}" ${hidden ? "hidden" : ""}>${label}</button>`;
}

function renderPage() {
  if (state.view === "board") return renderBoard();
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "notices") return renderNotices();
  return renderTaskList(state.view);
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

function option(value, label, current) {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderTaskList(scope) {
  const title = scope === "team" ? "팀 업무" : "내 업무";
  const body = scope === "team"
    ? "팀 전체 업무를 담당자, 상태, 우선순위 기준으로 훑어봅니다."
    : "나에게 배정되었거나 내가 만든 업무를 먼저 처리합니다.";
  const tasks = filteredTasks(scope);
  return `
    ${renderHead(title, body, `<button class="btn primary" data-action="focus-task-form">새 업무</button>`)}
    ${renderStats()}
    ${renderFilters()}
    <div class="content-grid">
      <section class="list">
        ${tasks.length ? tasks.map(renderTaskCard).join("") : `<div class="empty">조건에 맞는 업무가 없습니다.</div>`}
      </section>
      ${renderTaskForm()}
    </div>
  `;
}

function renderTaskCard(task) {
  const comments = state.comments.filter((comment) => comment.task_id === task.id);
  const project = state.projects.find((item) => item.id === task.project_id);
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
        <select data-task-status="${task.id}" aria-label="업무 상태 변경">
          ${Object.entries(STATUS_LABEL).map(([value, label]) => option(value, label, task.status)).join("")}
        </select>
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
  return `
    <aside class="card" id="taskFormCard">
      <h2>새 업무 만들기</h2>
      <form class="form" data-task-form>
        <input class="input" name="title" placeholder="업무 제목" required>
        <textarea name="description" placeholder="업무 설명"></textarea>
        <div class="form-row">
          <select name="assignee_id">
            ${state.profiles.map((profile) => option(profile.id, profile.full_name || profile.email, state.user.id)).join("")}
          </select>
          <select name="priority">
            ${Object.entries(PRIORITY_LABEL).map(([value, label]) => option(value, label, "normal")).join("")}
          </select>
        </div>
        <div class="form-row">
          <select name="status">
            ${Object.entries(STATUS_LABEL).map(([value, label]) => option(value, label, "todo")).join("")}
          </select>
          <input class="input" name="due_date" type="date">
        </div>
        <select name="project_id">
          <option value="">프로젝트 없음</option>
          ${state.projects.map((project) => option(project.id, project.name, "")).join("")}
        </select>
        <button class="btn primary">업무 저장</button>
      </form>
    </aside>
  `;
}

function renderBoard() {
  const tasks = filteredTasks("team");
  return `
    ${renderHead("업무 보드", "상태별로 팀 업무를 훑고, 카드에서 바로 상태를 바꿉니다.", `<button class="btn primary" data-view="mine">내 업무로 이동</button>`)}
    ${renderFilters()}
    <div class="board">
      ${Object.entries(STATUS_LABEL).map(([status, label]) => `
        <section class="column">
          <h3>${label}</h3>
          ${tasks.filter((task) => task.status === status).map((task) => `
            <div class="mini-task">
              <strong>${escapeHtml(task.title)}</strong>
              <div class="task-meta">
                <span class="pill">${escapeHtml(profileName(task.assignee_id))}</span>
                <span class="pill ${task.priority}">${PRIORITY_LABEL[task.priority]}</span>
              </div>
            </div>
          `).join("") || `<div class="empty">비어 있음</div>`}
        </section>
      `).join("")}
    </div>
  `;
}

function renderDashboard() {
  const tasks = filteredTasks("dashboard");
  const rows = state.profiles.map((profile) => {
    const assigned = state.tasks.filter((task) => task.assignee_id === profile.id && task.status !== "done");
    return {
      name: profile.full_name || profile.email,
      open: assigned.length,
      overdue: assigned.filter(isOverdue).length,
      review: assigned.filter((task) => task.status === "review").length
    };
  });
  return `
    ${renderHead("팀 대시보드", "매니저와 관리자가 팀 전체 진행 상황을 확인합니다.")}
    ${renderStats()}
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

function renderNotices() {
  const canWrite = ["admin", "manager"].includes(state.role);
  return `
    ${renderHead("공지", "팀 전체에 공유할 운영 메시지와 배포 안내를 남깁니다.")}
    <div class="content-grid">
      <section class="list">
        ${state.notices.length ? state.notices.map((notice) => `
          <article class="notice">
            <div class="task-meta">
              ${notice.pinned ? `<span class="pill high">고정</span>` : ""}
              <span class="pill">${escapeHtml(profileName(notice.author_id))}</span>
            </div>
            <h3>${escapeHtml(notice.title)}</h3>
            <p class="muted">${escapeHtml(notice.body)}</p>
          </article>
        `).join("") : `<div class="empty">아직 공지가 없습니다.</div>`}
      </section>
      <aside class="card ${canWrite ? "" : "hidden"}">
        <h2>공지 작성</h2>
        <form class="form" data-notice-form>
          <input class="input" name="title" placeholder="공지 제목" required>
          <textarea name="body" placeholder="공지 내용" required></textarea>
          <label><input type="checkbox" name="pinned"> 상단 고정</label>
          <button class="btn primary">공지 저장</button>
        </form>
      </aside>
    </div>
  `;
}

function renderAuth() {
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
        <p class="muted">${HAS_SUPABASE ? "회원가입 후 이메일 확인 설정에 따라 바로 로그인되지 않을 수 있습니다." : "데모 계정: admin@worktodo.local / admin123"}</p>
      </section>
      <section class="auth-visual">
        <h2>오늘 팀이 볼 화면</h2>
        <p>내 업무, 팀 보드, 관리자 대시보드, 공지까지 첫 화면에서 바로 접근합니다.</p>
        <div class="fake-board">
          <div class="fake-card"><strong>내 업무</strong><p>오늘 마감과 지연 업무를 우선 표시</p></div>
          <div class="fake-card"><strong>팀 보드</strong><p>할 일, 진행 중, 검토, 완료 상태 관리</p></div>
          <div class="fake-card"><strong>DB 저장</strong><p>Supabase Auth와 Postgres RLS 기반</p></div>
        </div>
      </section>
    </main>
  `;
  bindAuthEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await api.signOut();
    state.user = null;
    renderAuth();
  });

  document.querySelector("[data-action='focus-task-form']")?.addEventListener("click", () => {
    document.querySelector("#taskFormCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll("[data-filter]").forEach((field) => {
    field.addEventListener("input", () => {
      state.filters[field.dataset.filter] = field.value;
      render();
    });
  });

  document.querySelector("[data-task-form]")?.addEventListener("submit", handleTaskSubmit);
  document.querySelector("[data-notice-form]")?.addEventListener("submit", handleNoticeSubmit);

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
}

function bindAuthEvents() {
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
    await api.createTask(task);
    await refreshData();
    render();
    toast("업무를 만들었습니다.");
  } catch (error) {
    toast(error.message || "업무 생성에 실패했습니다.");
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
  try {
    await api.createNotice({
      title: form.get("title")?.toString().trim(),
      body: form.get("body")?.toString().trim(),
      pinned: form.get("pinned") === "on",
      importance: form.get("pinned") === "on" ? "important" : "normal"
    });
    await refreshData();
    render();
    toast("공지를 저장했습니다.");
  } catch (error) {
    toast(error.message || "공지 저장에 실패했습니다.");
  }
}

boot();
