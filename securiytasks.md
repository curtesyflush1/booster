# BoosterBeacon Code Improvement Checklist

This checklist is based on a deep-dive analysis of the BoosterBeacon repository. It is designed to provide actionable steps to enhance the security, efficiency, and maintainability of the application.

---

## Ⅰ. Backend Improvements (`/backend`)

### 🛡️ Security (High Priority)

* **Authentication & Authorization**
    * [ ] **Implement Token Revocation:** Create a token blacklist (e.g., using Redis) to immediately invalidate JWT refresh tokens upon logout or password change.
    * [ ] **Enhance Session Management:** On password change, invalidate all of the user's active sessions by revoking all their existing refresh tokens.
    * [ ] **Implement Granular RBAC:** Move beyond simple subscription tiers to a more robust Role-Based Access Control (RBAC) system with specific permissions for different user roles (e.g., `can_delete_users`, `can_view_system_stats`), especially for admin routes.

* **Credential Management**
    * [ ] **Integrate a Key Management Service (KMS):** For production, replace the static `ENCRYPTION_KEY` from environment variables with a dedicated service like AWS KMS, Google Cloud KMS, or HashiCorp Vault to manage encryption keys securely.
    * [ ] **Consider Per-User Encryption Keys:** For maximum security, investigate deriving unique encryption keys for each user based on their password to protect retailer credentials even if the main database is compromised.

* **Input Validation & Sanitization**
    * [ ] **Standardize Validation with Joi:** Refactor all controllers to consistently use Joi schemas for request validation, enforcing this pattern with a middleware.
    * [ ] **Sanitize All URL Parameters:** Explicitly sanitize all user-provided input from URL parameters (like `setName` in `productController.ts`) before they are used in database queries to prevent any potential SQL injection vectors.

---

### ⚡ Efficiency & Performance (Medium Priority)

* **Database Optimization**
    * [ ] **Enforce Pagination Globally:** Modify the `BaseModel` or create a new standard to ensure all database queries that can return multiple rows are paginated by default to prevent performance degradation with large datasets.
    * [ ] **Optimize `getUserAlertStats` Query:** Refactor the `Alert.getUserAlertStats` method to use a single, more complex SQL query with aggregations and window functions to reduce database round trips.
    * [ ] **Combine `getProductById` Queries:** In `productController.ts`, combine the two separate database calls in `getProductById` and `getProductBySlug` (one for the product, one for availability) into a single query using a `JOIN`.

* **Caching Strategy**
    * [ ] **Implement Distributed Caching:** Replace the current in-memory cache with a distributed cache like Redis (which is already in your `docker-compose.dev.yml`) to ensure cache consistency and scalability across multiple application instances.

---

### 🧹 Code Quality & Maintainability (Medium Priority)

* **Code Duplication**
    * [ ] **Create a `BaseRetailerService`:** Abstract the common logic found in the individual retailer services (`BestBuyService.ts`, `WalmartService.ts`, etc.) into a `BaseRetailerService` class to reduce code duplication and simplify adding new retailers.

* **Error Handling**
    * [ ] **Standardize Custom Error Classes:** Define and consistently use a set of custom error classes (e.g., `ValidationError`, `AuthenticationError`, `NotFoundError`) throughout the application to make error handling more predictable and robust.
    * [ ] **Add More Context to Error Logs:** Enhance the `errorHandler` middleware and general logging to include more context in error messages, such as stack traces, method names, and request IDs, to facilitate easier debugging.

* **Refactoring**
    * [ ] **Refactor Long Methods:** Break down long methods like `getDashboardStats` in `adminSystemService.ts` into smaller, single-responsibility functions (`getUserStatistics`, `getAlertStatistics`, etc.) to improve readability and testability.
    * [ ] **Extract Magic Numbers to Constants:** Remove hardcoded "magic numbers" (e.g., `60000` for intervals) and replace them with named constants to make the code more self-documenting and easier to maintain.
    * [ ] **Consider Dependency Injection:** For better testability, consider refactoring services to accept dependencies (like the database connection) via their constructor instead of relying on static methods like `BaseModel.getKnex()`.

---

## Ⅱ. Frontend Improvements (`/frontend`)

### 🛡️ Security (Medium Priority)

* **Cross-Site Scripting (XSS)**
    * [ ] **Implement Content Sanitization:** If you plan to display any user-generated content, ensure it is sanitized on the backend before being stored and rendered on the frontend to prevent XSS attacks.

---

### ⚡ Efficiency & Performance (Medium Priority)

* **API Requests**
    * [ ] **Consolidate Dashboard API Calls:** Create a dedicated backend endpoint to aggregate all the data required for the `DashboardPage`, reducing the number of initial API requests from multiple to a single call.
    * [ ] **Analyze Bundle Size:** Use a tool like `vite-plugin-visualizer` to inspect the production bundle and identify opportunities for further code splitting, especially for large components.

* **Rendering Performance**
    * [ ] **Use Memoization:** For components that are re-rendered frequently with the same props, apply `React.memo` to prevent unnecessary re-renders and improve UI performance.

---

### 🧹 Code Quality & Maintainability (Low Priority)

* **State Management**
    * [ ] **Evaluate Advanced State Management:** As the application grows, if you notice prop-drilling or overly complex Context providers, evaluate the need for a more robust state management library like Redux Toolkit or Zustand.

---

## Ⅲ. Browser Extension Improvements (`/extension`)

### 🛡️ Security (High Priority)

* **Permissions**
    * [ ] **Regularly Audit Permissions:** Periodically review the permissions requested in `manifest.chrome.json` to ensure the extension only asks for what is absolutely necessary for its functionality.

* **Content Scripts**
    * [ ] **Isolate Content Script Scope:** Ensure that the content script does not leak any variables or functions into the global scope of the web pages it runs on to avoid conflicts and potential security issues.

---

### ⚡ Efficiency & Performance (Medium Priority)

* **Background Script**
    * [ ] **Optimize Background Tasks:** Continue to use `chrome.alarms` for periodic tasks instead of `setInterval`. Ensure that any processing in the background script is lightweight and efficient to minimize impact on the user's browser performance.