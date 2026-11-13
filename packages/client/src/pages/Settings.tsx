import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RecipeFilter } from '../lib/recipes';
import { FILTER_GROUPS } from '../../../shared/recipeFilters';
import './Settings.css';

type UnitSystem = 'us' | 'metric';

const typeLabel = (type: string) =>
  FILTER_GROUPS.find((group) => group.type === type)?.label || type;

type Notifications = {
  dailySuggestions: boolean;
  groceryItems: boolean;
  weeklySummary: boolean;
  marketing: boolean;
};

const DEFAULT_NOTIFICATIONS: Notifications = {
  dailySuggestions: true,
  groceryItems: true,
  weeklySummary: false,
  marketing: false,
};

const TEXT_PREFERENCES = [
  {
    key: 'dietaryRestrictions',
    label: 'Dietary Restrictions',
    placeholder: 'e.g. Vegetarian, No shellfish',
  },
  {
    key: 'dislikes',
    label: 'Dislikes',
    placeholder: 'e.g. Blue cheese, Olives',
  },
  {
    key: 'allergies',
    label: 'Allergies',
    placeholder: 'e.g. Peanuts, Dairy',
  },
] as const;

const NOTIFICATION_OPTIONS: {
  key: keyof Notifications;
  title: string;
  description: string;
}[] = [
  {
    key: 'dailySuggestions',
    title: 'Daily recipe suggestions',
    description:
      'Get a fresh recipe match every morning based on your preferences.',
  },
  {
    key: 'groceryItems',
    title: 'New grocery list items',
    description:
      'Receive reminders when a saved recipe adds new pantry staples.',
  },
  {
    key: 'weeklySummary',
    title: 'Weekly meal planning summary',
    description:
      'See a weekly digest of saved recipes and suggested meal plans.',
  },
  {
    key: 'marketing',
    title: 'Marketing and product updates',
    description:
      'Hear about new features, seasonal collections, and partner offers.',
  },
];

const toList = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [servingSize, setServingSize] = useState(2);
  const [location, setLocation] = useState('');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('us');
  const [preferred, setPreferred] = useState<RecipeFilter[]>([]);
  const [filterGroups, setFilterGroups] = useState<Record<string, string[]>>(
    {}
  );

  const [textPrefs, setTextPrefs] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<Notifications>(
    DEFAULT_NOTIFICATIONS
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [settingsRes, recipesRes] = await Promise.all([
          fetch('/api/settings', { signal: controller.signal }),
          fetch('/api/recipes?view=summary', { signal: controller.signal }),
        ]);
        if (settingsRes.status === 401) {
          setLoggedIn(false);
          return;
        }
        if (!settingsRes.ok || !recipesRes.ok) throw new Error('load failed');
        const data = await settingsRes.json();
        const recipeData = await recipesRes.json();
        if (controller.signal.aborted) return;
        setEmail(data.email ?? '');
        setUsername(data.username ?? '');
        setServingSize(data.settings.servingSize);
        setLocation(data.settings.location);
        setUnitSystem(data.settings.unitSystem);
        setPreferred(data.settings.preferredFilters);
        setTextPrefs(
          Object.fromEntries(
            TEXT_PREFERENCES.map(({ key }) => [
              key,
              (data.settings[key] ?? []).join(', '),
            ])
          )
        );
        setNotifications(data.settings.notifications ?? DEFAULT_NOTIFICATIONS);
        setFilterGroups(recipeData.filterGroups ?? {});
      } catch {
        if (!controller.signal.aborted)
          setLoadError('Unable to load your settings. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const isPreferred = (type: string, name: string) =>
    preferred.some((f) => f.type === type && f.name === name);

  const togglePreferred = (filter: RecipeFilter) =>
    setPreferred((current) =>
      isPreferred(filter.type, filter.name)
        ? current.filter(
            (f) => f.type !== filter.type || f.name !== filter.name
          )
        : [...current, filter]
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          servingSize,
          location,
          unitSystem,
          preferredFilters: preferred,
          ...Object.fromEntries(
            TEXT_PREFERENCES.map(({ key }) => [
              key,
              toList(textPrefs[key] ?? ''),
            ])
          ),
          notifications,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || 'Unable to save settings.');
        return;
      }
      setMessage('Settings saved.');
    } catch {
      setError('Cannot reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {});
    navigate('/login', { replace: true });
  }

  if (loading) return <p role="status">Loading settings…</p>;
  if (!loggedIn)
    return (
      <section className="settings-page">
        <h1>Settings</h1>
        <p>
          Please <Link to="/login">log in</Link> to manage your settings.
        </p>
      </section>
    );
  if (loadError)
    return (
      <section className="settings-page">
        <h1>Settings</h1>
        <p role="alert">{loadError}</p>
      </section>
    );

  return (
    <section className="settings-page">
      <form id="settings-form" onSubmit={handleSubmit} aria-busy={saving}>
        <div className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>
              Manage your profile, preferences, and how Recipe Me works for you.
            </p>
          </div>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        <section aria-labelledby="profile-heading" className="settings-card">
          <h2 id="profile-heading">Profile / Account</h2>
          <p>
            Update the basics that keep your account and recipe experience
            personalized.
          </p>

          <div className="settings-field">
            <label htmlFor="full-name">Username</label>
            <input
              id="full-name"
              type="text"
              maxLength={80}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" value={email} readOnly disabled />
          </div>

          <div className="settings-field">
            <label htmlFor="serving-size">Default Serving Size</label>
            <input
              id="serving-size"
              type="number"
              min={1}
              max={20}
              step={1}
              value={servingSize}
              onChange={(e) => setServingSize(Number(e.target.value))}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              maxLength={100}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="unit-system">Preferred Unit System</label>
            <select
              id="unit-system"
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
            >
              <option value="us">US Customary</option>
              <option value="metric">Metric</option>
            </select>
          </div>
        </section>

        <hr />

        <section aria-labelledby="dietary-heading" className="settings-card">
          <h2 id="dietary-heading">Recipe Preferences</h2>
          <p>
            Checked options start pre-selected in your recipe filters on the
            home page.
          </p>

          {FILTER_GROUPS.filter(({ type }) => filterGroups[type]?.length).map(
            ({ type }) => (
              <fieldset className="settings-filter-group" key={type}>
                <legend>{typeLabel(type)}</legend>
                <div className="settings-filter-options">
                  {filterGroups[type].map((name) => (
                    <label
                      key={name}
                      className={`filter-pill ${
                        isPreferred(type, name) ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isPreferred(type, name)}
                        onChange={() => togglePreferred({ type, name })}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          )}
          {TEXT_PREFERENCES.map(({ key, label, placeholder }) => (
            <div className="settings-field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type="text"
                placeholder={placeholder}
                maxLength={500}
                value={textPrefs[key] ?? ''}
                onChange={(e) =>
                  setTextPrefs((current) => ({
                    ...current,
                    [key]: e.target.value,
                  }))
                }
              />
            </div>
          ))}

        </section>

        <hr />

        <section
          aria-labelledby="notifications-heading"
          className="settings-card"
        >
          <h2 id="notifications-heading">Email Notifications</h2>
          <p>
            Choose how Recipe Me keeps you informed about new matches and
            updates.
          </p>
          <div className="settings-notifications">
            {NOTIFICATION_OPTIONS.map(({ key, title, description }) => (
              <label className="notification-option" key={key}>
                <input
                  type="checkbox"
                  checked={notifications[key]}
                  onChange={(e) =>
                    setNotifications((current) => ({
                      ...current,
                      [key]: e.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <hr />

        <div className="settings-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" id="sign-out" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </form>
    </section>
  );
}
