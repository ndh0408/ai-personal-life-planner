# LifeOS AI — Product Spec

Status: living document. Last revised on the foundation rewrite (round 0).

---

## 1. App là gì

**LifeOS AI** là một app điện thoại đóng vai trò "hệ điều hành đời sống cá nhân":
một trợ lý chủ động, luôn-bật, biết bạn đang sống thế nào, và giúp bạn ra quyết
định nhanh hơn cho task, chi tiêu, ăn uống, ngủ, mood và lịch trong ngày.

Không phải:
- Một admin dashboard.
- Một to-do app cứng.
- Một app tài chính khô khan.
- Một chatbot rời rạc.

Nó là **một bề mặt duy nhất, đẹp, không cảm giác form**, mà bạn nói một câu —
và app hiểu, phân loại, lưu lại đúng nơi.

## 2. User chính là ai

- Cá nhân Việt Nam, 22–40 tuổi, có smartphone, có việc làm văn phòng /
  freelance / sáng tạo.
- Đã thử Notion, Todoist, Money Lover, MyFitnessPal — bỏ vì *quá nhiều form*.
- Không phải dev. Không hiểu "provider", "model", "baseURL", "temperature".
- Chỉ biết "tôi có một API key OpenAI" hoặc thậm chí chưa có (sẽ được hướng dẫn
  một-lần để tạo).

Persona phụ: developer/power user — sẽ được phục vụ qua Settings nâng cao
(progressive disclosure), không được phép ép xuất hiện ở core flow.

## 3. Core flow

```
Đăng ký / Đăng nhập
        │
        ▼
Onboarding (3 bước, ≤ 60 giây)
   1. Chào & locale
   2. Dán OpenAI API key  ──▶  Backend test thật ──▶ ✓ hoặc lỗi rõ ràng
   3. "Bạn đang quan tâm điều gì nhất?" (gợi ý card, không bắt nhập)
        │
        ▼
Home dashboard
   - Greeting + thời tiết của ngày
   - Quick Capture nổi rõ ở đáy màn hình
   - 2–3 card gợi ý (today plan, expense gần nhất, mood ✓ hôm nay?)
        │
        ▼
User dùng Quick Capture
   "ăn phở 60k"  /  "họp với An lúc 3h chiều"  /  "ngủ 6 tiếng tối qua"
        │
        ▼
Backend gọi OpenAI để phân loại + trích xuất
        │
        ▼
App preview kết quả parsed (chỉnh sửa nhẹ nếu cần)
        │
        ▼
User confirm  ──▶ Lưu thật vào Postgres ──▶ Card trên Home cập nhật ngay
```

Vòng quay xảy ra mỗi 5–30 giây. Không bao giờ kéo user vào form 8 trường.

## 4. Tính năng MVP

| Module | Mục tiêu | "Đủ tốt" nghĩa là gì |
|---|---|---|
| Auth | Đăng ký / đăng nhập / quên mật khẩu | JWT access + refresh, refresh quay vòng |
| Onboarding | ≤ 60 giây, không skip API key | Test key thật, không fake ✓ |
| OpenAI key setup | Nhập một lần, đổi trong Settings | AES-256-GCM at-rest, không lưu plaintext |
| Home dashboard | Greet + cards + Quick Capture | Cuộn được, kéo-làm-mới, render dưới 200ms khi có cache |
| Quick Capture | 1 ô nhập + nút mic | Phân loại đúng ≥ 90% trên 30 câu test vi+en |
| Task | Tạo / hoàn thành / hôm nay | Ngày, giờ, nhắc tuỳ chọn |
| Expense / Wallet | Thêm chi tiêu, xem theo ngày/tuần | VND mặc định, danh mục gợi ý |
| Meal log | Nhanh: "ăn X" → log | Cảm xúc / cảm giác no, không micro-nutrient |
| Sleep / mood check-in | 1 chạm | Mood emoji + giờ ngủ |
| Today planner | Danh sách task + chi tiêu hôm nay | Sắp xếp theo time block |
| AI schedule | Đề xuất khung giờ cho task tự do | Backend chấm điểm + xếp |
| Assistant recommendations | "Bạn nên uống nước", "Chi tiêu tăng 20% tuần này" | Card có hành động, không spam |
| AI chat | Hỏi assistant tự do | Lịch sử lưu local + server, có cancel |
| Settings | Tài khoản / khoá API / locale / xoá dữ liệu | Mọi thay đổi có hiệu lực ngay |
| i18n | vi + en | Toggle ngay; default theo device |
| Notification skeleton | Ghi đăng ký device, gửi local-first | Push thật ở phase 2 |
| Offline cache cơ bản | Read-after-write trên Home | Dùng MMKV / AsyncStorage |

## 5. Tính năng phase 2

- Multi-currency thật (tỷ giá realtime).
- HealthKit / Google Fit (sleep, steps, HR).
- Gmail / Outlook / Calendar import (event → task suggestion).
- Native widgets (iOS WidgetKit, Android Glance).
- Push thật qua APNs/FCM.
- Voice mode đầy-đủ (STT thời-gian-thực + TTS).
- Multi-device sync nâng cao (CRDT cho offline edit).
- Family / shared spaces.
- Báo cáo PDF / xuất CSV.
- Web companion app.

## 6. Những thứ KHÔNG làm ở MVP

- Không multi-provider AI (Anthropic / Google / Ollama). OpenAI only.
- Không tự host model. Không chọn baseURL. Không chọn temperature.
- Không HealthKit / Google Fit.
- Không integrate Gmail / Outlook / Slack.
- Không native iOS / Android widgets.
- Không tỷ giá ngoại tệ realtime — chỉ VND.
- Không enterprise k8s, không microservices. **Mọi thứ là một NestJS đơn + một Postgres + một Redis.**
- Không family/shared. Single-user only.
- Không advanced analytics tab.

## 7. Nguyên tắc ít nhập liệu

1. **Quick Capture là default**. Form chi tiết là ngoại lệ.
2. **Mọi field đều có smart default**: ngày = hôm nay, currency = VND, locale =
   device, time = round-to-nearest-15-min.
3. **Pickers thay vì text input** ở mọi nơi có thể (chip selector, emoji
   selector, slider).
4. **Không bắt user chọn category** trước khi viết. AI gợi ý sau.
5. **Không bắt confirm 2 lần** cùng một thông tin.
6. **Mỗi modal ≤ 3 trường nhập có ý nghĩa.** Nhiều hơn → tách bước.
7. **Không bắt buộc trường mô tả / note** ở bất kỳ entity nào.

## 8. OpenAI API key flow

1. Onboarding bước 2: ô dán key + nút "Tôi chưa có key" → modal hướng dẫn 4
   bước có ảnh chụp.
2. User dán → mobile gửi qua HTTPS tới `POST /api/ai/credentials`.
3. Backend:
   - Validate format `sk-…`.
   - Gọi `models.list` của OpenAI để xác nhận key sống.
   - Nếu OK → AES-256-GCM với `ENCRYPTION_KEY` (32-byte) → lưu
     `{ encryptedApiKey, iv, authTag, lastTestedAt, lastTestOk: true }`.
   - Nếu lỗi → trả mã lỗi rõ ràng (`invalid_key` / `quota_exceeded` /
     `network_error`); **không lưu, không fake ✓**.
4. Mobile chỉ giữ trạng thái `hasKey: true`. Không bao giờ giữ raw key.
5. Mọi lần app cần gọi OpenAI, mobile gọi backend; backend giải mã key trong
   memory cho duy nhất request đó.

## 9. Quick Capture

- **Trigger**: nút FAB ở mọi tab, kéo-lên ở Home, hoặc shortcut bàn phím.
- **Input**: 1 ô textarea + nút mic. Không có dropdown loại.
- **Pipeline**:
  1. User gõ / nói → "ăn cơm tấm 75k trưa nay".
  2. Mobile POST `/api/capture` với raw text + tz người dùng.
  3. Backend gọi OpenAI structured output → `{ kind, fields, confidence }`.
  4. Trả về preview chip (ví dụ: "🍚 Bữa ăn — Cơm tấm — 75 000 ₫ — 12:00").
  5. User chạm để chỉnh, hoặc swipe để confirm.
  6. Confirm → tạo record thật trong bảng tương ứng.
- **Fallback**: nếu confidence < 0.6 hoặc `kind = unknown`, hỏi 1 chip duy
  nhất ("Đây là gì?") thay vì form.

## 10. Privacy / security

- API key OpenAI: AES-256-GCM tại rest, không log plaintext, không trả về
  client sau khi lưu.
- Mật khẩu: bcrypt cost 12.
- Refresh token: hash sha256 trước khi lưu, quay vòng mỗi lần dùng.
- Mọi response không chứa field nhạy cảm (`passwordHash`, `encryptedApiKey`,
  `refreshTokenHash`).
- User có thể xoá tài khoản → cascade delete mọi bảng.
- Logs: redact email và mọi trường có pattern `sk-…`.
- Không gửi telemetry bên thứ ba ở MVP.
