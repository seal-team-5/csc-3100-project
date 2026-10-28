/*Settings page*/

function Settings() {
  return (
    <form id="settings-form">
      <div>
        <div>
          <h1>Settings</h1>
          <p>
            Manage your profile, preferences, and how Recipe Me works for you.
          </p>
        </div>
        <button type="submit">Save Changes</button>
      </div>

      {/* Profile / Account */}
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile / Account</h2>
        <p>
          Update the basics that keep your account and recipe experience
          personalized.
        </p>

        <div>
          <label htmlFor="full-name">Full Name</label>
          <input
            type="text"
            id="full-name"
            name="fullName"
            defaultValue="YourNameHere"
          />
        </div>

        <div>
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            defaultValue="yournamehere@yahoo.com"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" />
        </div>

        <div>
          <label htmlFor="serving-size">Default Serving Size</label>
          <input
            type="text"
            id="serving-size"
            name="servingSize"
            defaultValue="2 people"
          />
        </div>

        <div>
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            defaultValue="San Francisco, CA"
          />
        </div>

        <div>
          <label htmlFor="unit-system">Preferred Unit System</label>
          <input
            type="text"
            id="unit-system"
            name="unitSystem"
            defaultValue="US Customary"
          />
        </div>
      </section>

      <hr />

      {/* Dietary Preferences */}
      <section aria-labelledby="dietary-heading">
        <h2 id="dietary-heading">Dietary Preferences</h2>
        <p>
          Shape the recipes you see with the dietary needs and goals that matter
          most.
        </p>

        <div>
          <label htmlFor="dietary-restrictions">Dietary Restrictions</label>
          <input
            type="text"
            id="dietary-restrictions"
            name="dietaryRestrictions"
            defaultValue="Vegetarian, No shellfish"
          />
        </div>

        <div>
          <label htmlFor="dietary-goals">Dietary Goals</label>
          <input
            type="text"
            id="dietary-goals"
            name="dietaryGoals"
            defaultValue="Low carb, High protein"
          />
        </div>

        <div>
          <label htmlFor="dislikes">Dislikes</label>
          <input
            type="text"
            id="dislikes"
            name="dislikes"
            defaultValue="Blue cheese, Olives"
          />
        </div>

        <div>
          <label htmlFor="allergies">Allergies</label>
          <input
            type="text"
            id="allergies"
            name="allergies"
            defaultValue="None"
          />
        </div>

        <div>
          <label htmlFor="cuisine-preferences">Cuisine Preferences</label>
          <input
            type="text"
            id="cuisine-preferences"
            name="cuisinePreferences"
            defaultValue="Mediterranean, Korean"
          />
        </div>

        <div>
          <label htmlFor="store-preferences">Store Preferences</label>
          <input
            type="text"
            id="store-preferences"
            name="storePreferences"
            defaultValue="Whole Foods, Trader Joe’s"
          />
        </div>
      </section>

      <hr />

      {/* Notifications */}
      <section aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        <p>
          Choose how Recipe Me keeps you informed about new matches and updates.
        </p>

        <div>
          <input
            type="checkbox"
            id="notify-daily"
            name="notifyDaily"
            defaultChecked
          />
          <label htmlFor="notify-daily">Daily recipe suggestions</label>
          <p>
            Get a fresh recipe match every morning based on your preferences.
          </p>
        </div>

        <div>
          <input
            type="checkbox"
            id="notify-grocery"
            name="notifyGrocery"
            defaultChecked
          />
          <label htmlFor="notify-grocery">New grocery list items</label>
          <p>Receive reminders when a saved recipe adds new pantry staples.</p>
        </div>

        <div>
          <input type="checkbox" id="notify-weekly" name="notifyWeekly" />
          <label htmlFor="notify-weekly">Weekly meal planning summary</label>
          <p>See a weekly digest of saved recipes and suggested meal plans.</p>
        </div>

        <div>
          <input type="checkbox" id="notify-marketing" name="notifyMarketing" />
          <label htmlFor="notify-marketing">
            Marketing and product updates
          </label>
          <p>
            Hear about new features, seasonal collections, and partner offers.
          </p>
        </div>
      </section>

      <hr />

      <button type="button" id="sign-out">
        Sign Out
      </button>
    </form>
  );
}

export default Settings;
