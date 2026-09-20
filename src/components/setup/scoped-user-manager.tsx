"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type {
  ConstituencySummary,
  SetupScopedUser,
} from "@/lib/elect/types";

type Props = {
  electionId: string;
  constituencies: ConstituencySummary[];
  initialUsers: SetupScopedUser[];
};

type BackendEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type ManagedRole = "coordinator" | "observer";
type UserListTab = "active" | "archived";

type UserFormState = {
  name: string;
  login: string;
  password: string;
  role: ManagedRole;
  constituencyIds: number[];
  defaultConstituencyId: string;
};

const emptyForm: UserFormState = {
  name: "",
  login: "",
  password: "",
  role: "coordinator",
  constituencyIds: [],
  defaultConstituencyId: "",
};

const roleLabels: Record<ManagedRole, string> = {
  coordinator: "منسق دائرة",
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
    setForm({
      name: user.name,
      login: user.login,
      password: "",
      role: user.role,
      constituencyIds: user.constituencies.map((item) => item.id),
      defaultConstituencyId: String(
        user.default_constituency?.id ??
          user.constituencies[0]?.id ??
          "",
      ),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm<K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleConstituency(id: number) {
    setForm((current) => {
      const nextIds = current.constituencyIds.includes(id)
        ? current.constituencyIds.filter((item) => item !== id)
        : [...current.constituencyIds, id];

      const currentDefault = Number(current.defaultConstituencyId);
      let nextDefault = current.defaultConstituencyId;

      if (!nextIds.length) {
        nextDefault = "";
      } else if (!nextIds.includes(currentDefault)) {
        nextDefault = String(nextIds[0]);
      }

      return {
        ...current,
        constituencyIds: nextIds,
        defaultConstituencyId: nextDefault,
      };
    });
  }

  function validationError() {
    if (!form.name.trim()) return "أدخل اسم المستخدم.";
    if (!form.login.trim()) return "أدخل اسم الدخول.";
    if (!form.constituencyIds.length) {
      return "اختر دائرة محلية واحدة على الأقل.";
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

    setSaving(true);
    try {
      const defaultConstituencyId =
        Number(form.defaultConstituencyId) || form.constituencyIds[0];

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        login: form.login.trim(),
        role: form.role,
        constituency_ids: form.constituencyIds,
        default_constituency_id: defaultConstituencyId,
      };

      if (form.password) {
        body.password = form.password;
      }

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
      setUsers((current) => {
        if (editingId) {
          return current.map((item) =>
            item.id === saved.id ? saved : item,
          );
        }
        return [...current, saved];
      });

      setMessage(
        editingId
          ? "تم حفظ تعديلات المستخدم بنجاح."
          : "تم إنشاء المستخدم وتحديد صلاحياته بنجاح.",
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
            (active
              ? "تعذر استرجاع المستخدم."
              : "تعذر حذف المستخدم."),
        );
        return;
      }

      const saved = payload.data.item;
      setUsers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );

      if (!active && editingId === user.id) {
        resetForm();
      }

      setDeleteCandidate(null);
      setMessage(
        active
          ? "تم استرجاع المستخدم وأصبح حسابه نشطًا."
          : "تم حذف المستخدم من الحسابات النشطة مع الاحتفاظ بسجله التاريخي.",
      );
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setBusyUserId(null);
    }
  }

  const formTitle = editingId ? "تعديل المستخدم" : "إنشاء مستخدم";
  const formSubtitle = editingId
    ? "عدّل بيانات الدخول والدور والدوائر. اترك كلمة المرور فارغة إذا لم ترد تغييرها."
    : "أنشئ حسابًا وحدد الدوائر التي يمكنه الوصول إليها.";

  return (
    <div className="scoped-user-admin">
      <section className="scoped-user-editor-card">
        <div className="scoped-user-card-head">
          <div>
            <span>{editingId ? "تعديل الحساب" : "حساب جديد"}</span>
            <h2>{formTitle}</h2>
            <p>{formSubtitle}</p>
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
                placeholder="اسم المستخدم"
              />
            </label>

            <label>
              <span>اسم الدخول</span>
              <input
                required
                value={form.login}
                onChange={(event) => updateForm("login", event.target.value)}
                placeholder="login"
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
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  updateForm("password", event.target.value)
                }
                autoComplete="new-password"
                placeholder={editingId ? "اتركها فارغة دون تغيير" : "8 أحرف على الأقل"}
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
                <option value="coordinator">منسق دائرة</option>
                <option value="observer">مراقب</option>
              </select>
            </label>
          </div>

          <fieldset className="scoped-user-constituencies">
            <legend>الدوائر المسموح بها</legend>
            {localConstituencies.map((constituency) => (
              <label key={constituency.id}>
                <input
                  type="checkbox"
                  checked={form.constituencyIds.includes(constituency.id)}
                  onChange={() => toggleConstituency(constituency.id)}
                />
                <span>
                  <strong>{constituency.name}</strong>
                  <small>{constituency.region.name}</small>
                </span>
              </label>
            ))}
          </fieldset>

          {form.constituencyIds.length ? (
            <label className="scoped-user-default-field">
              <span>الدائرة التي تفتح مباشرة بعد تسجيل الدخول</span>
              <select
                value={
                  form.defaultConstituencyId ||
                  String(form.constituencyIds[0])
                }
                onChange={(event) =>
                  updateForm(
                    "defaultConstituencyId",
                    event.target.value,
                  )
                }
              >
                {localConstituencies
                  .filter((item) =>
                    form.constituencyIds.includes(item.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          <div className="scoped-user-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "جارٍ الحفظ…"
                : editingId
                  ? "حفظ التعديلات"
                  : "إنشاء المستخدم"}
            </button>

            <small>
              الحذف في Geniura آمن: يعطّل الحساب ويحتفظ بالسجل التاريخي
              ويمكن استرجاعه لاحقًا.
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
            <p>ابحث ثم عدّل الحساب أو احذفه أو استرجعه.</p>
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
              placeholder="الاسم، الدخول، الدور أو الدائرة"
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
              <article
                className={!user.active ? "is-archived" : ""}
                key={user.id}
              >
                <div className="scoped-user-identity">
                  <strong>{user.name}</strong>
                  <small>{user.login}</small>
                </div>

                <span className="scoped-user-role">
                  {roleLabel(user)}
                </span>

                <div className="scoped-user-scope">
                  {user.constituencies.map((constituency) => (
                    <span key={constituency.id}>
                      {constituency.name}
                      {user.default_constituency?.id === constituency.id
                        ? " · افتراضية"
                        : ""}
                    </span>
                  ))}
                </div>

                <div className="scoped-user-row-actions">
                  {user.active ? (
                    <>
                      <button
                        type="button"
                        onClick={() => beginEdit(user)}
                        disabled={busyUserId === user.id}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="is-delete"
                        onClick={() => {
                          clearFeedback();
                          setDeleteCandidate(user);
                        }}
                        disabled={busyUserId === user.id}
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
                      {busyUserId === user.id ? "جارٍ الاسترجاع…" : "استرجاع"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="setup-empty">
            {query
              ? "لا يوجد مستخدم مطابق للبحث."
              : listTab === "active"
                ? "لا توجد حسابات نشطة."
                : "لا توجد حسابات محذوفة."}
          </div>
        )}
      </section>

      {deleteCandidate ? (
        <div
          className="scoped-user-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteCandidate(null);
            }
          }}
        >
          <section
            className="scoped-user-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <span>تأكيد الحذف</span>
            <h3 id="delete-user-title">
              حذف حساب {deleteCandidate.name}؟
            </h3>
            <p>
              سيتوقف المستخدم عن تسجيل الدخول فورًا، لكن لن نحذف سجله
              التاريخي أو العلاقات المرتبطة به. يمكنك استرجاع الحساب لاحقًا
              من تبويب «محذوفون».
            </p>
            <div>
              <button
                type="button"
                className="scoped-user-secondary-button"
                onClick={() => setDeleteCandidate(null)}
                disabled={busyUserId === deleteCandidate.id}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="scoped-user-confirm-delete"
                onClick={() =>
                  void setUserActive(deleteCandidate, false)
                }
                disabled={busyUserId === deleteCandidate.id}
              >
                {busyUserId === deleteCandidate.id
                  ? "جارٍ الحذف…"
                  : "نعم، حذف المستخدم"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
