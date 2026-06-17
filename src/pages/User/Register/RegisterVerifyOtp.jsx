import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Luồng OTP đã bỏ — chuyển về đăng ký trực tiếp. */
export default function RegisterVerifyOtp() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/register', { replace: true })
  }, [navigate])

  return null
}
