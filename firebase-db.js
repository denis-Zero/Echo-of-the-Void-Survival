const firebaseConfig = {
  apiKey: "AIzaSyAvBfs1IiBkFjlQva7-7_txIR9wZqh2Klg",
  authDomain: "kingdom-of-monsters.firebaseapp.com",
  projectId: "kingdom-of-monsters",
  storageBucket: "kingdom-of-monsters.firebasestorage.app",
  messagingSenderId: "322428612359",
  appId: "1:322428612359:web:16523ddfc319f56763dfa2",
  measurementId: "G-99JTS8HX37"
};

// Initialize Firebase SDK V10 Compat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Expor estado globalmente
window.firebaseUser = null;

// Observador de mudança de tela (entrou/saiu)
auth.onAuthStateChanged(async (user) => {
  if (user) {
    window.firebaseUser = user;
    updateUIAuth(user);
    // Tenta trazer os dados da Nuvem para o Jogo
    await syncDownFromCloud();
  } else {
    window.firebaseUser = null;
    updateUIAuth(null);
  }
});

// Ações chamadas livremente pelos botões HTML
window.fbLoginWithGoogle = async () => {
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Erro de Autenticação:", error);
  }
};

window.fbLogout = async () => {
  try {
    await auth.signOut();
  } catch(error) {
    console.error("Erro ao Deslogar:", error);
  }
};

// =============================
// Motor Cloud Save
// =============================
window.fbSaveSettingsToCloud = async (localData) => {
  if (!window.firebaseUser) return; // Sem backup se não estiver logado
  try {
    const userRef = db.collection("users_echovoid").doc(window.firebaseUser.uid);
    // Salva ou sobrescreve com união de chaves
    await userRef.set({
      saveData: localData,
      lastUpdated: new Date().getTime()
    }, { merge: true });
  } catch (err) {
    console.error("Erro Firestore Upload", err);
  }
};

async function syncDownFromCloud() {
  if (!window.firebaseUser) return;
  try {
    const userRef = db.collection("users_echovoid").doc(window.firebaseUser.uid);
    const snap = await userRef.get();
    
    if (snap.exists) {
      const data = snap.data();
      if (data && data.saveData) {
        // Envia pro script.js fazer as fusões em tempo real nas variáveis globais e recarregar
        if(typeof window.mergeCloudSave === 'function') {
          window.mergeCloudSave(data.saveData);
        }
      }
    } else {
      // É a primeira vez que ele faz login. Envie o progresso nativo Local dele pra Nuvem
      if(typeof window.forcePushLocalToCloud === 'function') {
        window.forcePushLocalToCloud();
      }
    }
  } catch (err) {
    console.error("Erro Firestore Download:", err);
  }
}

// =============================
// Gestão Básica de UI embutida
// =============================
function updateUIAuth(user) {
  const loginBtn = document.getElementById("auth-login-btn");
  const avatarArea = document.getElementById("auth-user-info");
  const avatarImg = document.getElementById("auth-avatar");
  const avatarName = document.getElementById("auth-name");

  if(user) {
    if(loginBtn) loginBtn.style.display = "none";
    if(avatarArea) avatarArea.style.display = "flex";
    if(avatarImg) avatarImg.src = user.photoURL || "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg";
    if(avatarName) avatarName.innerText = user.displayName.split(" ")[0];
  } else {
    if(loginBtn) loginBtn.style.display = "flex";
    if(avatarArea) avatarArea.style.display = "none";
  }
}
