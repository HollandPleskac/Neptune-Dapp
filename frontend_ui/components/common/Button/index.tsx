import cx from 'classnames'
import styles from './button.module.scss'

const Button = ({ text, color, className, onClick }: Props) => {
  return (
    <button className={cx(color, styles[className])} onClick={onClick}>{text}</button>
  )
}

type Props = {
  text: string,
  color?: string,
  className: string,
  onClick?: () => void
}

export default Button