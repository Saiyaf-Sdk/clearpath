import { Link, Navigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';

const steps = [
  ['1', 'Submit one request', 'Apply for clearance online instead of carrying a paper form to every office.'],
  ['2', 'Departments review', 'Library, Hostel, Finance, Labs, Sports and Student Affairs clear you in parallel.'],
  ['3', 'Settle dues online', 'See exactly what you owe, pay, and upload the receipt for verification.'],
  ['4', 'Download certificate', 'Get a PDF clearance certificate with a QR code anyone can verify.'],
];

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="home">
      <section className="hero">
        <h1>University clearance, without the queues.</h1>
        <p className="lead">
          ClearPath replaces the paper no-dues form with one online request, live status from every department,
          and a verifiable digital certificate.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary">Start my clearance</Link>
          <Link to="/login" className="btn btn-ghost">Staff / student login</Link>
        </div>
      </section>

      <section className="steps">
        {steps.map(([n, title, text]) => (
          <div className="card step" key={n}>
            <div className="step-num">{n}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
