// Home Page Application
const homeApp = {
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
    }
};

// Close modal on background click
document.getElementById('aboutModal').addEventListener('click', function(e) {
    if (e.target === this) {
        homeApp.closeAbout();
    }
});

