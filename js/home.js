// Home Page Application
const homeApp = {
    init() {
        this.loadVersion();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    showAbout() {
        const modal = document.getElementById('aboutModal');
        modal.classList.add('active');
    },

    closeAbout() {
        const modal = document.getElementById('aboutModal');
        modal.classList.remove('active');
    },

    async loadVersion() {
        try {
            const response = await fetch('documentation/data/changelog.json');
            const data = await response.json();
            if (data.version) {
                document.getElementById('versionText').textContent = 'Version ' + data.version;
            }
        } catch (e) {
            // Keep default version
        }
    }
};

// Close modal on background click
document.getElementById('aboutModal').addEventListener('click', function(e) {
    if (e.target === this) {
        homeApp.closeAbout();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    homeApp.init();
});
