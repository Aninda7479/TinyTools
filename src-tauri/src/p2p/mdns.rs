use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use std::net::IpAddr;

pub const SERVICE_TYPE: &str = "_tinytools._tcp.local.";
pub const SERVICE_INSTANCE: &str = "TinyTools";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PeerInfo {
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub hostname: String,
}

pub struct MdnsService {
    daemon: ServiceDaemon,
    receiver: mdns_sd::Receiver<mdns_sd::ServiceEvent>,
    peers: HashMap<String, PeerInfo>,
}

impl MdnsService {
    pub fn new() -> Result<Self, String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS daemon error: {}", e))?;
        let receiver = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("mDNS browse error: {}", e))?;
        Ok(Self {
            daemon,
            receiver,
            peers: HashMap::new(),
        })
    }

    pub fn register(&self, port: u16) -> Result<(), String> {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "TinyTools".to_string());

        let local_ip = get_local_ip();

        let mut properties = std::collections::HashMap::new();
        properties.insert("version".to_string(), "0.1.0".to_string());

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &format!("{}@{}", SERVICE_INSTANCE, hostname),
            &format!("{}.local.", hostname),
            &local_ip,
            port,
            properties,
        )
        .map_err(|e| format!("mDNS service info error: {}", e))?;

        self.daemon
            .register(service_info)
            .map_err(|e| format!("mDNS register error: {}", e))?;
        Ok(())
    }

    pub fn unregister(&self) -> Result<(), String> {
        let _ = self.daemon.unregister(SERVICE_TYPE);
        Ok(())
    }

    pub fn poll_peers(&mut self) -> Vec<PeerInfo> {
        while let Ok(event) = self.receiver.try_recv() {
            if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                if let Some(addr) = info.get_addresses().iter().next() {
                    let peer = PeerInfo {
                        name: info.get_fullname().to_string(),
                        ip: addr.to_string(),
                        port: info.get_port(),
                        hostname: info.get_hostname().to_string(),
                    };
                    self.peers
                        .insert(peer.ip.clone(), peer.clone());
                }
            }
        }
        self.peers.values().cloned().collect()
    }

    pub fn get_peers(&self) -> Vec<PeerInfo> {
        self.peers.values().cloned().collect()
    }

    pub fn remove_stale_peers(&mut self) {
        self.peers.clear();
    }
}

pub fn get_local_ip() -> IpAddr {
    local_ip_address::local_ip().unwrap_or(IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)))
}
