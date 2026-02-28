import { useEffect } from 'react'

export default function Toast({ message, onDismiss, duration = 4000 }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, duration)
        return () => clearTimeout(timer)
    }, [onDismiss, duration])

    return (
        <div className="toast">
            <span>{message}</span>
            <span className="toast-hint">Ctrl+Z to undo</span>
        </div>
    )
}
