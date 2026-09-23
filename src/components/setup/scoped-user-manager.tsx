"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type {
  ConstituencySummary,
  SetupPollingArea,
  SetupScopedUser,
} from "@/lib/elect/types";

type Props = {
  electionId: string;
  constituencies: ConstituencySummary[];
  pollingAreas: SetupPollingArea[];
  initialUsers: SetupScopedUser[];
};

type BackendEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type ManagedRole = "coordinator" | "observer";
type UserListTab = "active" | "archived";
type ScopeLevel = "constituency" | "polling_area";

type UserFormState = {
  name: string;
  login: string;
  password: string;
  role: ManagedRole;
  scopeLevel: ScopeLevel;
  constituencyId: string;
  pollingAreaId: string;
};

const emptyForm: UserFormState = {
  name: "",
  login: "",
  password: "",
  role: "coordinator",
  scopeLevel: "constituency",
  constituencyId: "",
  pollingAreaId: "",
};

const roleLabels: Record<ManagedRole, string> = {
  coordinator: "منسق",
  observer: "مراقب",
};

function roleLabel(user: SetupScopedUser) {
  if (user.role === "coordinator") return roleLabels.coordinator;
  if (user.role === "observer") return roleLabels.observer;
  return "مدير";
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا");
}

export function ScopedUserManager({
  electionId,
  constituencies,
  pollingAreas,
  initialUsers,
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [listTab, setListTab] = useState<UserListTab>("active");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<SetupScopedUser | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const localConstituencies = useMemo(
    () => constituencies.filter((item) => item.kind === "local"),
    [constituencies],
  );

  const activeCount = users.filter((user) => user.active).length;
  const archivedCount = users.length - activeCount;

  const visibleUsers = useMemo(() => {
    const needle = normalizeSearch(query);
    return users
      .filter((user) =>
        listTab === "active" ? user.active : !user.active,
      )
      .filter((user) => {
        if (!needle) return true;
        const haystack = normalizeSearch(
          [
            user.name,
            user.login,
            roleLabel(user),
            ...user.constituencies.map((item) => item.name),
            ...(user.polling_areas ?? []).map((item) => item.name),
          ].join(" "),
        );
        return haystack.includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [listTab, query, users]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function beginCreate() {
    clearFeedback();
    setDeleteCandidate(null);
    resetForm();
  }

  function beginEdit(user: SetupScopedUser) {
    if (user.role === "manager") return;
    clearFeedback();
    setDeleteCandidate(null);
    setEditingId(user.id);

    const area = user.polling_areas?.[0];
    setForm({
      name: user.name,
      login: user.login,
      password: "",
      role: user.role,
      scopeLevel: area ? "polling_area" : "constituency",
      constituencyId: String(
        area?.constituency_id ??
          user.default_constituency?.id ??
          user.constituencies[0]?.id ??
          "",
      ),
      pollingAreaId: area ? String(area.id) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm<K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validationError() {
    if (!form.name.trim()) return "أدخل اسم المستخدم.";
    if (!form.login.trim()) return "أدخل اسم الدخول.";
    if (form.scopeLevel === "constituency" && !form.constituencyId) {
      return "اختر الدائرة الانتخابية المسموح بها.";
    }
    if (form.scopeLevel === "polling_area" && !form.pollingAreaId) {
      return "اختر الجماعة / المقاطعة المسموح بها.";
    }
    if (!editingId && form.password.length < 8) {
      return "كلمة المرور المؤقتة يجب أن تتكون من 8 أحرف على الأقل.";
    }
    if (editingId && form.password && form.password.length < 8) {
      return "كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.";
    }
    return "";
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const validation = validationError();
    if (validation) {
      setError(validation);
      return;
    }

    const selectedArea =
      form.scopeLevel === "polling_area"
        ? pollingAreas.find((item) => item.id === Number(form.pollingAreaId))
        : null;
    const constituencyId =
      selectedArea?.constituency.id ?? Number(form.constituencyId);

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        login: form.login.trim(),
        role: form.role,
        constituency_ids: constituencyId ? [constituencyId] : [],
        default_constituency_id: constituencyId,
        polling_area_ids:
          form.scopeLevel === "polling_area" && selectedArea
            ? [selectedArea.id]
            : [],
      };

      if (form.password) body.password = form.password;

      const url = editingId
        ? `/api/operations/elections/${encodeURIComponent(electionId)}/setup/users/${editingId}`
        : `/api/operations/elections/${encodeURIComponent(electionId)}/setup/users`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as BackendEnvelope<{ item: SetupScopedUser }> | null;

      if (!response.ok || !payload?.success || !payload.data?.item) {
        setError(
          payload?.error?.message ||
            (editingId
              ? "تعذر حفظ تعديلات المستخدم."
              : "تعذر إنشاء المستخدم."),
        );
        return;
      }

      const saved = payload.data.item;
      setUsers((current) =>
        editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved],
      );
      setMessage(
        editingId
          ? "تم حفظ صلاحيات المستخدم."
          : "تم إنشاء المستخدم وتحديد نطاق وصوله.",
      );
      resetForm();
      setListTab("active");
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setSaving(false);
    }
  }

  async function setUserActive(user: SetupScopedUser, active: boolean) {
    clearFeedback();
    setBusyUserId(user.id);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/users/${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as BackendEnvelope<{ item: SetupScopedUser }> | null;

      if (!response.ok || !payload?.success || !payload.data?.item) {
        setError(
          payload?.error?.message ||
            (active ? "تعذر استرجاع المستخدم." : "تعذر حذف المستخدم."),
        );
        return;
      }
      const saved = payload.data.item;
      setUsers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      if (!active && editingId === user.id) resetForm();
      setDeleteCandidate(null);
      setMessage(
        active
          ? "تم استرجاع المستخدم وأصبح حسابه نشطًا."
          : "تم تعطيل المستخدم مع الاحتفاظ بسجله التاريخي.",
      );
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setBusyUserId(null);
    }
  }

  const formTitle = editingId ? "تعديل المستخدم" : "إنشاء مستخدم";

  return (
    <div className="scoped-user-admin">
      <section className="scoped-user-editor-card">
        <div className="scoped-user-card-head">
          <div>
            <span>{editingId ? "تعديل الحساب" : "حساب جديد"}</span>
            <h2>{formTitle}</h2>
            <p>
              اختر هل يصل المستخدم إلى دائرة كاملة أم إلى جماعة / مقاطعة
              واحدة فقط.
            </p>
          </div>
          {editingId ? (
            <button
              className="scoped-user-secondary-button"
              type="button"
              onClick={beginCreate}
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>

        <form onSubmit={submitUser}>
          <div className="scoped-user-form-grid">
            <label>
              <span>الاسم</span>
              <input
                required
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
              />
            </label>
            <label>
              <span>اسم الدخول</span>
              <input
                required
                value={form.login}
                onChange={(event) => updateForm("login", event.target.value)}
                autoCapitalize="none"
                autoComplete="username"
              />
            </label>
            <label>
              <span>
                {editingId ? "كلمة مرور جديدة (اختياري)" : "كلمة مرور مؤقتة"}
              </span>
              <input
                required={!editingId}
                type="password"
                minLength={editingId ? undefined : 8}
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>الدور</span>
              <select
                value={form.role}
                onChange={(event) =>
                  updateForm("role", event.target.value as ManagedRole)
                }
              >
                <option value="coordinator">منسق</option>
                <option value="observer">مراقب</option>
              </select>
            </label>
          </div>

          <fieldset className="scoped-user-scope-level">
            <legend>نطاق الصلاحية</legend>
            <label>
              <input
                type="radio"
                name="scopeLevel"
                checked={form.scopeLevel === "constituency"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    scopeLevel: "constituency",
                    pollingAreaId: "",
                  }))
                }
              />
              <span>
                <strong>دائرة انتخابية كاملة</strong>
                <small>يرى كل الجماعات / المقاطعات التابعة للدائرة.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="scopeLevel"
                checked={form.scopeLevel === "polling_area"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    scopeLevel: "polling_area",
                    constituencyId: "",
                  }))
                }
              />
              <span>
                <strong>جماعة / مقاطعة فقط</strong>
                <small>لا يرى بقية الدائرة الانتخابية.</small>
              </span>
            </label>
          </fieldset>

          {form.scopeLevel === "constituency" ? (
            <label className="scoped-user-default-field">
              <span>الدائرة الانتخابية المسموح بها</span>
              <select
                value={form.constituencyId}
                onChange={(event) =>
                  updateForm("constituencyId", event.target.value)
                }
              >
                <option value="">اختر الدائرة</option>
                {localConstituencies.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="scoped-user-default-field">
              <span>الجماعة / المقاطعة المسموح بها</span>
              <select
                value={form.pollingAreaId}
                onChange={(event) =>
                  updateForm("pollingAreaId", event.target.value)
                }
              >
                <option value="">اختر الجماعة / المقاطعة</option>
                {pollingAreas
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "ar"))
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.constituency.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="scoped-user-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "جارٍ الحفظ…"
                : editingId
                  ? "حفظ التعديلات"
                  : "إنشاء المستخدم"}
            </button>
            <small>
              الحذف آمن: يعطّل الحساب ولا يحذف سجله التاريخي.
            </small>
          </div>

          {error ? (
            <div className="scoped-user-message is-error" role="alert">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="scoped-user-message is-success" role="status">
              {message}
            </div>
          ) : null}
        </form>
      </section>

      <section className="scoped-user-list-card scoped-user-management-list">
        <div className="scoped-user-card-head">
          <div>
            <span>إدارة الحسابات</span>
            <h2>المستخدمون</h2>
            <p>يظهر نطاق الوصول الحقيقي لكل مستخدم.</p>
          </div>
          <strong>{users.length}</strong>
        </div>

        <div className="scoped-user-list-toolbar">
          <label>
            <span>بحث</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="الاسم، الدخول، الدور، الدائرة أو الجماعة"
            />
          </label>
          <div className="scoped-user-tabs" role="tablist">
            <button
              type="button"
              className={listTab === "active" ? "is-selected" : ""}
              onClick={() => setListTab("active")}
            >
              نشطون <strong>{activeCount}</strong>
            </button>
            <button
              type="button"
              className={listTab === "archived" ? "is-selected" : ""}
              onClick={() => setListTab("archived")}
            >
              محذوفون <strong>{archivedCount}</strong>
            </button>
          </div>
        </div>

        {visibleUsers.length ? (
          <div className="scoped-user-list">
            {visibleUsers.map((user) => (
              <article className={!user.active ? "is-archived" : ""} key={user.id}>
                <div className="scoped-user-identity">
                  <strong>{user.name}</strong>
                  <small>{user.login}</small>
                </div>
                <span className="scoped-user-role">{roleLabel(user)}</span>
                <div className="scoped-user-scope">
                  {user.polling_areas?.length
                    ? user.polling_areas.map((item) => (
                        <span className="is-area" key={item.id}>
                          {item.name} فقط
                        </span>
                      ))
                    : user.constituencies.map((item) => (
                        <span key={item.id}>{item.name} · دائرة كاملة</span>
                      ))}
                </div>
                <div className="scoped-user-row-actions">
                  {user.active ? (
                    <>
                      <button type="button" onClick={() => beginEdit(user)}>
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="is-delete"
                        onClick={() => {
                          clearFeedback();
                          setDeleteCandidate(user);
                        }}
                      >
                        حذف
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="is-restore"
                      onClick={() => void setUserActive(user, true)}
                      disabled={busyUserId === user.id}
                    >
                      استرجاع
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="setup-empty">لا توجد حسابات مطابقة.</div>
        )}
      </section>

      {deleteCandidate ? (
        <div className="scoped-user-delete-backdrop" role="presentation">
          <section
            className="scoped-user-delete-dialog"
            role="dialog"
            aria-modal="true"
          >
            <span>تأكيد الحذف</span>
            <h3>حذف حساب {deleteCandidate.name}؟</h3>
            <p>
              سيُعطّل تسجيل الدخول، ويمكن استرجاع الحساب لاحقًا دون فقدان
              السجل التاريخي.
            </p>
            <div>
              <button
                type="button"
                className="scoped-user-secondary-button"
                onClick={() => setDeleteCandidate(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="scoped-user-confirm-delete"
                onClick={() => void setUserActive(deleteCandidate, false)}
              >
                نعم، حذف المستخدم
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
