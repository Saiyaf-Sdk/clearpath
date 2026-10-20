import { motion } from 'framer-motion';
import { AppFooter } from './Footer';

export const EASE = [0.22, 1, 0.36, 1];

// Wraps every route: soft fade + lift + de-blur in, quick fade out.
// `wide` pages (the landing page) manage their own width and footer.
export default function Page({ children, wide = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {wide ? (
        children
      ) : (
        <>
          <div className="container">{children}</div>
          <AppFooter />
        </>
      )}
    </motion.div>
  );
}

// Fades + slides content in the first time it scrolls into view
export function Reveal({ children, delay = 0, y = 28, className, style, amount = 0.25 }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// Staggered list helpers: parent variants={stagger} initial="hidden" animate|whileInView="show"; children variants={item}
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
