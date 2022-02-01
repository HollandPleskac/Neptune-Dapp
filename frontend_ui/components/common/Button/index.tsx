import cx from 'classnames'
import styles from './button.module.scss'

const Button = ({ text, color, className }: Props) => {
  return (
    <button className={cx(color, styles[className])}>{text}</button>
  )
}

type Props = {
  text: string,
  color: string,
  className: string
}

export default Button