# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=e4]:
    - button "Back to Home" [ref=e6] [cursor=pointer]:
      - img
      - img
      - text: Back to Home
    - generic [ref=e7]:
      - img "Golden Luxury Auto" [ref=e8]
      - paragraph [ref=e9]: Admin Portal Login
    - generic [ref=e10]:
      - generic [ref=e11]:
        - text: Email
        - textbox "Email" [ref=e12]:
          - /placeholder: admin@goldenluxuryauto.com
          - text: verifytest@gla.local
      - generic [ref=e13]:
        - generic [ref=e14]:
          - generic [ref=e15]: Password
          - link "Forgot password?" [ref=e16] [cursor=pointer]:
            - /url: /reset-password
        - textbox "Password" [ref=e17]:
          - /placeholder: ••••••••
          - text: VerifyTest@123
      - button "Signing in..." [disabled]
    - paragraph [ref=e18]: Premium vehicle management portal
```