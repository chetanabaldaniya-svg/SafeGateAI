/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, UserCheck, Send, History, Clock, ThumbsUp, ThumbsDown, CheckCircle2, BarChart3, XCircle, Mail, MailCheck, MailWarning, Camera, X, Users, ArrowDown, ArrowUp, Bell, Smartphone, Search, QrCode, Home, Info, ChevronRight } from 'lucide-react';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';

export default function App() {
  const [mode, setMode] = useState<'delivery' | 'guest' | 'residents'>('delivery');
  const [company, setCompany] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [hostName, setHostName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ checkInId: string; status: string; message: string; company?: string; visitorName?: string; flatNumber: string; ciba?: any } | null>(null);
  const [cibaStatus, setCibaStatus] = useState<{ id: string; status: string; resolvedAt?: string } | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<{ id: string; flatNumber: string; company: string; timestamp: string; status: string; resolvedAt?: string; emailStatus?: string }[]>([]);
  const [guestLogs, setGuestLogs] = useState<{ id: string; flatNumber: string; visitorName: string; hostName?: string; purpose?: string; timestamp: string; status: string; }[]>([]);
  const [residents, setResidents] = useState<{ id: string; flatNumber: string; email: string; isVerified: boolean; }[]>([]);
  const [stats, setStats] = useState<{ total: number; accuracy: number; tp: number; tn: number; fp: number; fn: number } | null>(null);
  
  // Resident Form State
  const [residentEmail, setResidentEmail] = useState('');
  const [residentFlat, setResidentFlat] = useState('');
  const [residentLoading, setResidentLoading] = useState(false);
  const [residentMessage, setResidentMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(true);
  const [selectedResident, setSelectedResident] = useState<{ id: string; flatNumber: string; email: string; isVerified: boolean; } | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Sorting state
  const [cibaSortOrder, setCibaSortOrder] = useState<'desc' | 'asc'>('desc');
  const [guestSortOrder, setGuestSortOrder] = useState<'desc' | 'asc'>('desc');

  // Search state
  const [cibaSearchQuery, setCibaSearchQuery] = useState('');
  const [guestSearchQuery, setGuestSearchQuery] = useState('');

  // Resident Notifications State
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; message: string; timestamp: Date; logId?: string; status?: string }[]>([]);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();

  const startCamera = async (mode: 'photo' | 'qr' = 'photo') => {
    if (mode === 'qr') {
      setIsScanningQR(true);
      setIsCameraOpen(false);
    } else {
      setIsCameraOpen(true);
      setIsScanningQR(false);
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if (mode === 'qr') {
          requestRef.current = requestAnimationFrame(scanQR);
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
      setIsScanningQR(false);
    }
  };

  const scanQR = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          try {
            const data = JSON.parse(code.data);
            if (data.visitorName) setVisitorName(data.visitorName);
            if (data.flatNumber) setFlatNumber(data.flatNumber);
            if (data.hostName) setHostName(data.hostName);
            if (data.purpose) setPurpose(data.purpose);
            if (data.company) setCompany(data.company);
            
            // Auto-switch mode based on data
            if (data.company) setMode('delivery');
            else if (data.visitorName) setMode('guest');
            
            stopCamera();
            return; // Stop scanning
          } catch (e) {
            console.error("Invalid QR code data format", e);
          }
        }
      }
    }
    if (isScanningQR) {
      requestRef.current = requestAnimationFrame(scanQR);
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsScanningQR(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const fetchLogs = async () => {
    try {
      const [cibaRes, guestRes, residentsRes] = await Promise.all([
        fetch('/api/gate/ciba-logs'),
        fetch('/api/gate/guest-logs'),
        fetch('/api/gate/residents')
      ]);
      if (cibaRes.ok) {
        const data = await cibaRes.json();
        setLogs(data);
      }
      if (guestRes.ok) {
        const data = await guestRes.json();
        setGuestLogs(data);
      }
      if (residentsRes.ok) {
        const data = await residentsRes.json();
        setResidents(data);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/gate/feedback-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  const handleManualResolve = async (id: string, status: 'approved' | 'denied') => {
    try {
      const res = await fetch(`/api/gate/resolve/${id}/${status}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        fetchLogs();
        if (cibaStatus?.id === id) {
          setCibaStatus({ id, status, resolvedAt: new Date().toISOString() });
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resolve request');
      }
    } catch (e) {
      console.error('Failed to manually resolve', e);
      alert('Failed to manually resolve request. Please try again.');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();

    const interval = setInterval(() => {
      fetchLogs();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cibaStatus?.status === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/gate/ciba-status/${cibaStatus.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status !== 'pending') {
              setCibaStatus(data);
              fetchLogs();
            }
          }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [cibaStatus?.status, cibaStatus?.id]);

  useEffect(() => {
    // WebSocket connection for real-time resident notifications
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'ciba_pending') {
          setNotifications(prev => [{
            id: Math.random().toString(36).substring(7),
            type: 'ciba_pending',
            title: 'Approval Required',
            message: `Delivery from ${payload.data.company} for Flat ${payload.data.flatNumber}`,
            timestamp: new Date(),
            logId: payload.data.id,
            status: 'pending'
          }, ...prev].slice(0, 5));
        } else if (payload.type === 'guest_arrival') {
          setNotifications(prev => [{
            id: Math.random().toString(36).substring(7),
            type: 'guest_arrival',
            title: 'Guest Arrived',
            message: `${payload.data.visitorName} has arrived for Flat ${payload.data.flatNumber}`,
            timestamp: new Date()
          }, ...prev].slice(0, 5));
        } else if (payload.type === 'ciba_resolved') {
          setNotifications(prev => prev.map(n => 
            n.logId === payload.data.id ? { ...n, status: payload.data.status } : n
          ));
        }
      } catch (e) {
        console.error('WebSocket message parsing error:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const sortedCibaLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return cibaSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const filteredCibaLogs = sortedCibaLogs.filter(log => 
    log.flatNumber.toLowerCase().includes(cibaSearchQuery.toLowerCase()) ||
    log.company.toLowerCase().includes(cibaSearchQuery.toLowerCase())
  );

  const sortedGuestLogs = [...guestLogs].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return guestSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const filteredGuestLogs = sortedGuestLogs.filter(log => 
    log.flatNumber.toLowerCase().includes(guestSearchQuery.toLowerCase()) ||
    log.visitorName.toLowerCase().includes(guestSearchQuery.toLowerCase()) ||
    (log.hostName && log.hostName.toLowerCase().includes(guestSearchQuery.toLowerCase())) ||
    (log.purpose && log.purpose.toLowerCase().includes(guestSearchQuery.toLowerCase()))
  );

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'delivery' && !company) {
      setError('Please enter the company name.');
      return;
    }
    if (mode === 'guest' && !visitorName) {
      setError('Please enter the visitor name.');
      return;
    }
    if (!flatNumber) {
      setError('Please enter the flat number.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setFeedbackStatus('idle');

    try {
      if (mode === 'guest') {
        const response = await fetch('/api/gate/guest-check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorName, flatNumber, hostName, purpose }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to verify guest');
        
        setResult({ ...data, visitorName, flatNumber });
        setCibaStatus(null);
        fetchLogs();
      } else {
        const response = await fetch('/api/gate/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorCompany: company, flatNumber }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to verify delivery');

        setResult({ ...data, company, flatNumber });
        if (data.status !== 'Verified') {
          if (data.ciba?.status === 'unverified') {
            setCibaStatus({ id: '', status: 'unverified' });
          } else {
            setCibaStatus({ id: data.ciba.logId, status: 'pending' });
          }
          fetchLogs();
        } else {
          setCibaStatus(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (isAccurate: boolean) => {
    if (!result) return;
    setFeedbackStatus('submitting');
    try {
      await fetch('/api/gate/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInId: result.checkInId,
          company: result.company,
          flatNumber: result.flatNumber,
          aiStatus: result.status,
          isAccurate
        })
      });
      setFeedbackStatus('submitted');
      fetchStats();
    } catch (e) {
      console.error('Failed to submit feedback', e);
      setFeedbackStatus('idle');
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleResidentAction = async (logId: string, status: 'approved' | 'denied', notifId: string) => {
    try {
      const res = await fetch(`/api/gate/resolve/${logId}/${status}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, status } : n));
        fetchLogs();
        if (cibaStatus?.id === logId) {
          setCibaStatus({ id: logId, status, resolvedAt: new Date().toISOString() });
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resolve request');
      }
    } catch (e) {
      console.error('Failed to resolve from notification', e);
      alert('Failed to manually resolve request. Please try again.');
    }
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setResidentLoading(true);
    setResidentMessage(null);
    try {
      const res = await fetch('/api/gate/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flatNumber: residentFlat, email: residentEmail })
      });
      if (res.ok) {
        setResidentMessage({ type: 'success', text: 'Verification email sent successfully!' });
        setResidentFlat('');
        setResidentEmail('');
        fetchLogs(); // Refresh residents list
      } else {
        const data = await res.json();
        setResidentMessage({ type: 'error', text: data.error || 'Failed to add resident' });
      }
    } catch (err) {
      setResidentMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setResidentLoading(false);
    }
  };

  const handleMockVerify = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/gate/residents/${id}/mock-verify`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchLogs(); // Refresh residents list
        if (selectedResident && selectedResident.id === id) {
          setSelectedResident(prev => prev ? { ...prev, isVerified: true } : null);
        }
      }
    } catch (err) {
      console.error('Failed to mock verify resident', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <ShieldCheck className="h-6 w-6 text-blue-600 mr-2" />
                About SafeGate AI
              </h2>
              <button 
                onClick={() => setShowAboutModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-slate-600">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-2">Hackathon Submission</h3>
                <p className="text-blue-800 font-medium">
                  Built for the <a href="https://auth0-ai.devpost.com/" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">Authorized to Act: Auth0 for AI Agents</a> hackathon on Devpost.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">The Problem</h3>
                <p>Security gates at residential complexes are a bottleneck. Guards manually verify every delivery driver, leading to long queues and frustrated residents. We need a way to automate this without compromising security.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">The Solution: AI + Auth0</h3>
                <p className="mb-3">SafeGate AI uses an AI Agent to automatically vet incoming deliveries by scanning the resident's recent email confirmations (via Gmail API). If a match is found, the gate opens instantly.</p>
                <p><strong>But what if the AI isn't sure?</strong></p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                  <UserCheck className="h-5 w-5 text-indigo-600 mr-2" />
                  Authorized to Act (Auth0 CIBA)
                </h3>
                <p className="mb-4">
                  When the AI Agent cannot confidently verify a delivery, it must be <strong>Authorized to Act</strong>. It uses <strong>Auth0 CIBA (Client-Initiated Backchannel Authentication)</strong> to send a secure push notification directly to the resident's mobile device.
                </p>
                <ul className="space-y-2 list-disc list-inside ml-2">
                  <li>The AI Agent pauses the gate entry.</li>
                  <li>Auth0 CIBA securely routes an approval request to the resident's authenticated device.</li>
                  <li>The resident reviews the request and taps "Approve".</li>
                  <li>The AI Agent receives the authorization token and opens the gate.</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident App Simulator (Floating Panel) */}
      <div className="fixed bottom-4 right-4 z-50 w-80 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          {notifications.map(notif => (
            <div key={notif.id} className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center text-white/90 text-xs font-medium">
                  <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                  Resident App
                </div>
                <button onClick={() => removeNotification(notif.id)} className="text-white/50 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-start">
                  <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-full ${notif.type === 'ciba_pending' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="ml-3 w-full">
                    <h4 className="text-sm font-semibold text-slate-900">{notif.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                    
                    {notif.type === 'ciba_pending' && notif.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={() => handleResidentAction(notif.logId!, 'approved', notif.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 rounded transition-colors"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleResidentAction(notif.logId!, 'denied', notif.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1.5 rounded transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {notif.type === 'ciba_pending' && notif.status === 'approved' && (
                      <div className="mt-2 text-xs font-medium text-green-600 flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approved
                      </div>
                    )}
                    {notif.type === 'ciba_pending' && notif.status === 'denied' && (
                      <div className="mt-2 text-xs font-medium text-red-600 flex items-center">
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Denied
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-4xl">
        <div className="text-center mb-10 relative">
          <button 
            onClick={() => setShowAboutModal(true)}
            className="absolute right-0 top-0 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors flex items-center"
          >
            <Info className="h-4 w-4 mr-1.5" />
            Hackathon Info
          </button>
          <div className="flex justify-center items-center mb-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">SafeGate <span className="text-blue-600">AI</span></h1>
          <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
            Intelligent security gate management powered by AI vetting and Auth0 CIBA authorization.
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          <div className="flex p-1 space-x-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('delivery'); setResult(null); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'delivery' ? 'bg-white text-blue-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => { setMode('guest'); setResult(null); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'guest' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Guest
            </button>
            <button
              type="button"
              onClick={() => { setMode('residents'); setResult(null); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center ${mode === 'residents' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Home className="h-4 w-4 mr-1.5" />
              Residents
            </button>
          </div>

          {mode === 'residents' ? (
            <div className="space-y-6">
              {selectedResident ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center mb-6">
                    <button 
                      onClick={() => setSelectedResident(null)}
                      className="text-slate-500 hover:text-slate-900 transition-colors flex items-center text-sm font-medium"
                    >
                      <ArrowDown className="h-4 w-4 mr-1 rotate-90" />
                      Back to Residents
                    </button>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Flat {selectedResident.flatNumber}</h3>
                        <p className="text-sm text-slate-500">{selectedResident.email}</p>
                      </div>
                      {selectedResident.isVerified ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="h-4 w-4 mr-1.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="h-4 w-4 mr-1.5" /> Pending
                        </span>
                      )}
                    </div>
                    
                    <div className="p-8 flex flex-col items-center justify-center">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4">
                        <QRCodeSVG 
                          value={JSON.stringify({ flatNumber: selectedResident.flatNumber, email: selectedResident.email })} 
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <h4 className="text-sm font-medium text-slate-900 mb-1">Resident QR Code</h4>
                      <p className="text-xs text-slate-500 text-center max-w-xs">
                        This QR code contains the resident's flat number and email address. It can be used for quick identification.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {showVerificationPrompt && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <Info className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">Verification Required</h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>Residents must verify their email address before they can approve or deny delivery requests.</p>
                          </div>
                        </div>
                      </div>
                      {residents.some(r => r.isVerified) && (
                        <button
                          type="button"
                          onClick={() => setShowVerificationPrompt(false)}
                          className="absolute top-2 right-2 p-1 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleAddResident} className="space-y-4">
                <div>
                  <label htmlFor="residentFlat" className="block text-sm font-medium text-slate-700">
                    Flat Number
                  </label>
                  <div className="mt-1">
                    <input
                      id="residentFlat"
                      type="text"
                      required
                      value={residentFlat}
                      onChange={(e) => setResidentFlat(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors"
                      placeholder="e.g. 101"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="residentEmail" className="block text-sm font-medium text-slate-700">
                    Resident Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="residentEmail"
                      type="email"
                      required
                      value={residentEmail}
                      onChange={(e) => setResidentEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-colors"
                      placeholder="e.g. resident@example.com"
                    />
                  </div>
                </div>
                
                {residentMessage && (
                  <div className={`rounded-md p-3 border text-sm font-medium ${residentMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {residentMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={residentLoading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                >
                  {residentLoading ? (
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  ) : (
                    <Mail className="h-5 w-5 mr-2" />
                  )}
                  Send Verification Link
                </button>
              </form>

              <div className="pt-6 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-900 mb-3">Registered Residents</h4>
                {residents.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No residents registered yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {residents.map(r => (
                      <li 
                        key={r.id} 
                        onClick={() => setSelectedResident(r)}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-lg border border-slate-100 transition-colors group"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900">Flat {r.flatNumber}</div>
                          <div className="text-xs text-slate-500">{r.email}</div>
                        </div>
                        <div className="flex items-center">
                          {r.isVerified ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-3">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                            </span>
                          ) : (
                            <div className="flex items-center mr-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 mr-2">
                                <Clock className="h-3 w-3 mr-1" /> Pending
                              </span>
                              <button
                                onClick={(e) => handleMockVerify(r.id, e)}
                                className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded transition-colors font-medium"
                              >
                                Mock Verify
                              </button>
                            </div>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </>
              )}
            </div>
          ) : (
          <form className="space-y-6" onSubmit={handleCheckIn}>
            <div>
              <label htmlFor="flatNumber" className="block text-sm font-medium text-slate-700">
                Flat / Unit Number
              </label>
              <div className="mt-1">
                <input
                  id="flatNumber"
                  name="flatNumber"
                  type="text"
                  required
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  placeholder="e.g. 402A"
                />
              </div>
            </div>

            {mode === 'delivery' ? (
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700">
                  Delivery Company Name
                </label>
                <div className="mt-1">
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                    placeholder="e.g. Zomato, Amazon, Swiggy"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="visitorName" className="block text-sm font-medium text-slate-700">
                    Visitor Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="visitorName"
                      name="visitorName"
                      type="text"
                      required
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="hostName" className="block text-sm font-medium text-slate-700">
                    Host Resident's Name (Optional)
                  </label>
                  <div className="mt-1">
                    <input
                      id="hostName"
                      name="hostName"
                      type="text"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                      placeholder="e.g. Jane Smith"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="purpose" className="block text-sm font-medium text-slate-700">
                    Purpose of Visit (Optional)
                  </label>
                  <div className="mt-1">
                    <input
                      id="purpose"
                      name="purpose"
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                      placeholder="e.g. Plumber, Friend, Tutor"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ShieldAlert className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Camera / Photo Section */}
            {(isCameraOpen || isScanningQR) && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                {isScanningQR && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-blue-500/50 m-8 rounded-lg flex items-center justify-center">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                      Position QR Code in frame
                    </div>
                  </div>
                )}

                <button type="button" onClick={stopCamera} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors z-10">
                  <X className="h-5 w-5" />
                </button>
                
                {isCameraOpen && (
                  <button type="button" onClick={capturePhoto} className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-2 rounded-full font-medium shadow-lg hover:bg-slate-100 transition-colors z-10">
                    Capture
                  </button>
                )}
              </div>
            )}
            
            {photo && !isCameraOpen && !isScanningQR && (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video shadow-inner">
                <img src={photo} alt="Visitor" className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-3">
                  <button type="button" onClick={() => { setPhoto(null); startCamera('photo'); }} className="bg-white/90 backdrop-blur-sm text-slate-800 px-4 py-2 rounded-full font-medium shadow-lg hover:bg-white transition-colors flex items-center text-sm">
                    <Camera className="h-4 w-4 mr-2" />
                    Retake Photo
                  </button>
                  <button type="button" onClick={() => setPhoto(null)} className="bg-slate-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-full font-medium shadow-lg hover:bg-slate-900 transition-colors flex items-center text-sm">
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex space-x-3">
              {!isCameraOpen && !isScanningQR && !photo && (
                <>
                  <button
                    type="button"
                    onClick={() => startCamera('photo')}
                    className="flex-1 flex justify-center items-center py-2.5 px-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <Camera className="h-5 w-5 mr-1.5 text-slate-500" />
                    Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera('qr')}
                    className="flex-1 flex justify-center items-center py-2.5 px-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <QrCode className="h-5 w-5 mr-1.5 text-slate-500" />
                    Scan QR
                  </button>
                </>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`${(!isCameraOpen && !isScanningQR && !photo) ? 'flex-[2]' : 'w-full'} flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${mode === 'guest' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    {mode === 'guest' ? 'Logging...' : 'Vetting...'}
                  </>
                ) : (
                  mode === 'guest' ? 'Log Guest Entry' : 'Verify Visitor'
                )}
              </button>
            </div>
          </form>
          )}

          {mode !== 'residents' && result && (
            <div className={`mt-6 rounded-xl p-5 border ${mode === 'guest' ? 'bg-indigo-50 border-indigo-200' : (result.status === 'Verified' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  {mode === 'guest' ? (
                    <Users className="h-6 w-6 text-indigo-600" />
                  ) : result.status === 'Verified' ? (
                    <UserCheck className="h-6 w-6 text-green-600" />
                  ) : (
                    <Send className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <div className="ml-3 w-full">
                  <h3 className={`text-lg font-semibold ${mode === 'guest' ? 'text-indigo-800' : (result.status === 'Verified' ? 'text-green-800' : 'text-amber-800')}`}>
                    {mode === 'guest' ? 'Guest Logged Successfully' : result.status}
                  </h3>
                  <div className={`mt-2 text-sm ${mode === 'guest' ? 'text-indigo-700' : (result.status === 'Verified' ? 'text-green-700' : 'text-amber-700')}`}>
                    <p>{result.message}</p>
                  </div>
                  {mode === 'delivery' && result.status !== 'Verified' && (
                    <div className="mt-3">
                      {cibaStatus?.status === 'pending' ? (
                        <div className="bg-white/60 rounded-lg p-3 text-xs text-amber-800 font-medium border border-amber-200/50 flex flex-col gap-3">
                          <div className="flex items-center">
                            <span className="relative flex h-2 w-2 mr-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            Awaiting resident approval via Auth0 CIBA...
                          </div>
                          <div className="flex space-x-2 border-t border-amber-200/50 pt-2">
                            <button
                              onClick={() => handleManualResolve(cibaStatus.id, 'approved')}
                              className="flex-1 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-medium transition-colors"
                            >
                              Manual Approve
                            </button>
                            <button
                              onClick={() => handleManualResolve(cibaStatus.id, 'denied')}
                              className="flex-1 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-medium transition-colors"
                            >
                              Manual Deny
                            </button>
                          </div>
                        </div>
                      ) : cibaStatus?.status === 'approved' ? (
                        <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 font-medium border border-green-200 flex items-center justify-between">
                          <div className="flex items-center">
                            <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-600" />
                            Resident Approved
                          </div>
                          <span className="text-green-600/80">{cibaStatus.resolvedAt ? new Date(cibaStatus.resolvedAt).toLocaleTimeString() : ''}</span>
                        </div>
                      ) : cibaStatus?.status === 'denied' ? (
                        <div className="bg-red-50 rounded-lg p-3 text-xs text-red-800 font-medium border border-red-200 flex items-center justify-between">
                          <div className="flex items-center">
                            <XCircle className="h-4 w-4 mr-1.5 text-red-600" />
                            Resident Denied
                          </div>
                          <span className="text-red-600/80">{cibaStatus.resolvedAt ? new Date(cibaStatus.resolvedAt).toLocaleTimeString() : ''}</span>
                        </div>
                      ) : cibaStatus?.status === 'unverified' ? (
                        <div className="bg-red-50 rounded-lg p-3 text-xs text-red-800 font-medium border border-red-200 flex items-center justify-between">
                          <div className="flex items-center">
                            <ShieldAlert className="h-4 w-4 mr-1.5 text-red-600" />
                            Resident email not verified. Cannot approve delivery.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback UI - Only for AI Delivery Mode */}
              {mode === 'delivery' && (
                <div className={`mt-4 pt-4 border-t ${result.status === 'Verified' ? 'border-green-200/60' : 'border-amber-200/60'}`}>
                  {feedbackStatus === 'submitted' ? (
                    <div className={`flex items-center text-sm font-medium ${result.status === 'Verified' ? 'text-green-700' : 'text-amber-700'}`}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Feedback logged for AI retraining. Thank you!
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${result.status === 'Verified' ? 'text-green-800' : 'text-amber-800'}`}>
                        Was this AI prediction accurate?
                      </span>
                      <div className="flex space-x-2">
                        <button 
                          type="button"
                          onClick={() => submitFeedback(true)} 
                          disabled={feedbackStatus === 'submitting'} 
                          className={`p-1.5 rounded-md transition-colors ${result.status === 'Verified' ? 'text-green-600 hover:bg-green-100' : 'text-amber-600 hover:bg-amber-100'}`}
                          title="Yes, accurate"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => submitFeedback(false)} 
                          disabled={feedbackStatus === 'submitting'} 
                          className={`p-1.5 rounded-md transition-colors ${result.status === 'Verified' ? 'text-green-600 hover:bg-green-100' : 'text-amber-600 hover:bg-amber-100'}`}
                          title="No, inaccurate"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* CIBA Logs Section */}
        <div className="bg-white py-6 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center">
              <History className="h-5 w-5 text-slate-500 mr-2" />
              <h3 className="text-lg font-medium text-slate-900">Recent CIBA Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search flat or company..."
                  value={cibaSearchQuery}
                  onChange={(e) => setCibaSearchQuery(e.target.value)}
                  className="block w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                />
              </div>
              <button 
                onClick={() => setCibaSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors border border-slate-200"
              >
                {cibaSortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 mr-1" /> : <ArrowUp className="h-3.5 w-3.5 mr-1" />}
                {cibaSortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          </div>
          {filteredCibaLogs.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-4">
              {logs.length === 0 ? 'No notifications triggered yet.' : 'No logs match your search.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredCibaLogs.map(log => (
                <li key={log.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Flat {log.flatNumber}</p>
                    <p className="text-xs text-slate-500">{log.company}</p>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="flex items-center text-xs text-slate-400">
                      {log.emailStatus === 'sent' && <MailCheck className="h-3 w-3 mr-1.5 text-blue-500" title="Email Sent" />}
                      {log.emailStatus === 'failed' && <MailWarning className="h-3 w-3 mr-1.5 text-red-500" title="Email Failed" />}
                      {log.emailStatus === 'pending' && <Mail className="h-3 w-3 mr-1.5 text-slate-400" title="Email Pending" />}
                      
                      {log.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {log.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />}
                      {log.status === 'denied' && <XCircle className="h-3 w-3 mr-1 text-red-500" />}
                      <span className={`mr-1 ${log.status === 'approved' ? 'text-green-600' : log.status === 'denied' ? 'text-red-600' : ''}`}>
                        {log.status === 'pending' ? 'Pending' : log.status === 'approved' ? 'Approved' : 'Denied'}
                      </span>
                      • {new Date(log.resolvedAt || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {log.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleManualResolve(log.id, 'approved')}
                          className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleManualResolve(log.id, 'denied')}
                          className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-medium transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Guest Logs Section */}
        <div className="bg-white py-6 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-slate-500 mr-2" />
              <h3 className="text-lg font-medium text-slate-900">Recent Guest Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search guest, flat..."
                  value={guestSearchQuery}
                  onChange={(e) => setGuestSearchQuery(e.target.value)}
                  className="block w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                />
              </div>
              <button 
                onClick={() => setGuestSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors border border-slate-200"
              >
                {guestSortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 mr-1" /> : <ArrowUp className="h-3.5 w-3.5 mr-1" />}
                {guestSortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          </div>
          {filteredGuestLogs.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-4">
              {guestLogs.length === 0 ? 'No guests logged yet.' : 'No logs match your search.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredGuestLogs.map(log => (
                <li key={log.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Flat {log.flatNumber}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">{log.visitorName}</span>
                      {log.hostName && <span> visiting {log.hostName}</span>}
                      {log.purpose && <span> • {log.purpose}</span>}
                    </p>
                  </div>
                  <div className="flex items-center text-xs text-slate-400">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    <span className="mr-1 text-green-600">Vetted by Guard</span>
                    • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI Vetting Accuracy Stats Section */}
        {stats && stats.total > 0 && (
          <div className="bg-white py-6 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
            <div className="flex items-center mb-6">
              <BarChart3 className="h-5 w-5 text-slate-500 mr-2" />
              <h3 className="text-lg font-medium text-slate-900">AI Vetting Accuracy</h3>
            </div>
            
            <div className="flex items-center justify-center mb-8">
              <div className="text-5xl font-extrabold text-blue-600 tracking-tight">{stats.accuracy.toFixed(1)}%</div>
              <div className="ml-3 text-sm text-slate-500 leading-tight">
                overall<br/>
                <span className="font-medium text-slate-700">{stats.total}</span> reviews
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-green-50/80 p-3 rounded-xl border border-green-100">
                <div className="text-green-800 font-semibold mb-1">True Positives</div>
                <div className="text-green-600 text-2xl font-bold">{stats.tp}</div>
                <div className="text-green-700/80 text-xs mt-1 leading-tight">AI: Verified<br/>Guard: Accurate</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-slate-800 font-semibold mb-1">True Negatives</div>
                <div className="text-slate-600 text-2xl font-bold">{stats.tn}</div>
                <div className="text-slate-500 text-xs mt-1 leading-tight">AI: Manual<br/>Guard: Accurate</div>
              </div>
              <div className="bg-red-50/80 p-3 rounded-xl border border-red-100">
                <div className="text-red-800 font-semibold mb-1">False Positives</div>
                <div className="text-red-600 text-2xl font-bold">{stats.fp}</div>
                <div className="text-red-700/80 text-xs mt-1 leading-tight">AI: Verified<br/>Guard: Inaccurate</div>
              </div>
              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-100">
                <div className="text-amber-800 font-semibold mb-1">False Negatives</div>
                <div className="text-amber-600 text-2xl font-bold">{stats.fn}</div>
                <div className="text-amber-700/80 text-xs mt-1 leading-tight">AI: Manual<br/>Guard: Inaccurate</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-500 mt-8">
          <p>Powered by Auth0 & Gmail API</p>
        </div>
      </div>
    </div>
  );
}
