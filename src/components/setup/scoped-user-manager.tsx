"use client";

import { useMemo, useState } from "react";

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

const roleLabels = {
  coordinator: "منسق دائرة",
  observer: "مراقب",
} as const;

export function ScopedUserManager({
  electionId,
  constituencies,
  initialUsers,
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"coordinator" | "observer">("coordinator");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [defaultId, setDefaultId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const localConstituencies = useMemo(
    () => constituencies.filter((item) => item.kind === "local"),
    [constituencies],
  );

  function toggleConstituency(id: number) {
    setSelectedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      if (!next.length) {
        setDefaultId("");
      } else if (!next.includes(Number(defaultId))) {
        setDefaultId(String(next[0]));
      }
      return next;
    });
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedIds.length) {
      setError("اختر دائرة محلية واحدة على الأقل.");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور المؤقتة يجب أن تتكون من 8 أحرف على الأقل.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            login: login.trim(),
            password,
            role,
            constituency_ids: selectedIds,
            default_constituency_id:
              Number(defaultId) || selectedIds[0],
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as BackendEnvelope<{ item: SetupScopedUser }> | null;

      if (!response.ok || !payload?.success || !payload.data?.item) {
        setError(
          payload?.error?.message ||
            "تعذر إنشاء المستخدم. تحقق من البيانات ثم حاول مرة أخرى.",
        );
        return;
      }

      setUsers((current) => [...current, payload.data!.item]);
      setName("");
      setLogin("");
      setPassword("");
      setRole("coordinator");
      setSelectedIds([]);
      setDefaultId("");
      setMessage("تم إنشاء المستخدم وتقييد صلاحياته بنجاح.");
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: SetupScopedUser) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/operations/elections/${encodeURIComponent(electionId)}/setup/users/${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !user.active }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as BackendEnvelope<{ item: SetupScopedUser }> | null;
      if (!response.ok || !payload?.success || !payload.data?.item) {
        setError(payload?.error?.message || "تعذر تحديث المستخدم.");
        return;
      }
      setUsers((current) =>
        current.map((entry) =>
          entry.id === user.id ? payload.data!.item : entry,
        ),
      );
      setMessage(user.active ? "تم تعطيل المستخدم." : "تم تفعيل المستخدم.");
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    }
  }

  return (
    <div className="scoped-user-manager">
      <form className="scoped-user-create-card" onSubmit={createUser}>
        <div className="scoped-user-card-head">
          <div>
            <span>حساب جديد</span>
            <h2>إنشاء مستخدم بصلاحية محددة</h2>
            <p>
              إذا منحت المستخدم طنجة–أصيلة فقط، سيدخل مباشرة إلى Dashboard
              الخاص بها ولن تعرض له الدوائر الأخرى.
            </p>
          </div>
        </div>

        <div className="scoped-user-form-grid">
          <label>
            <span>الاسم</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="اسم المستخدم"
            />
          </label>
          <label>
            <span>اسم الدخول</span>
            <input
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="login"
              autoCapitalize="none"
            />
          </label>
          <label>
            <span>كلمة مرور مؤقتة</span>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>الدور</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "coordinator" | "observer")
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
                checked={selectedIds.includes(constituency.id)}
                onChange={() => toggleConstituency(constituency.id)}
              />
              <span>
                <strong>{constituency.name}</strong>
                <small>{constituency.region.name}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {selectedIds.length > 1 ? (
          <label className="scoped-user-default-field">
            <span>الدائرة التي تفتح مباشرة بعد الدخول</span>
            <select
              value={defaultId}
              onChange={(event) => setDefaultId(event.target.value)}
            >
              {localConstituencies
                .filter((item) => selectedIds.includes(item.id))
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
            {saving ? "جارٍ الإنشاء…" : "إنشاء المستخدم"}
          </button>
          <small>
            لا تُعرض كلمة المرور مرة أخرى بعد الإنشاء.
          </small>
        </div>

        {error ? <div className="scoped-user-message is-error">{error}</div> : null}
        {message ? (
          <div className="scoped-user-message is-success">{message}</div>
        ) : null}
      </form>

      <section className="scoped-user-list-card">
        <div className="scoped-user-card-head">
          <div>
            <span>الحسابات المقيّدة</span>
            <h2>المستخدمون الحاليون</h2>
          </div>
          <strong>{users.length}</strong>
        </div>

        {users.length ? (
          <div className="scoped-user-list">
            {users.map((user) => (
              <article key={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.login}</small>
                </div>
                <span className="scoped-user-role">
                  {user.role === "coordinator"
                    ? roleLabels.coordinator
                    : user.role === "observer"
                      ? roleLabels.observer
                      : "مدير"}
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
                <button
                  type="button"
                  className={user.active ? "is-active" : "is-inactive"}
                  onClick={() => void toggleActive(user)}
                >
                  {user.active ? "تعطيل" : "تفعيل"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="setup-empty">
            لم يتم إنشاء مستخدمين مقيّدين بالدائرة بعد.
          </div>
        )}
      </section>
    </div>
  );
}
