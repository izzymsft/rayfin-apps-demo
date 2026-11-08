export function ErrorMessage({ message }: { message?: string | null }) {
  return message ? <p className="error-message" role="alert">{message}</p> : null;
}
