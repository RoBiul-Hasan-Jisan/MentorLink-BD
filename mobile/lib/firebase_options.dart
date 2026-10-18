import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show kIsWeb;

// Public client config for Firebase project mentorlink-67926 (not secret).
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform => kIsWeb ? web : android;

  static const android = FirebaseOptions(
    apiKey: 'AIzaSyDIzUT-wLdEnsnh7fSbrFiM8YhF7STtrx0',
    appId: '1:766994609429:android:c4713edf42a9ca10f9e51c',
    messagingSenderId: '766994609429',
    projectId: 'mentorlink-67926',
    storageBucket: 'mentorlink-67926.firebasestorage.app',
  );

  static const web = FirebaseOptions(
    apiKey: 'AIzaSyBhVOB4SWXMMxmVf8yECF2UBG9DOqAwTOQ',
    appId: '1:766994609429:web:47beeec6097e05fff9e51c',
    messagingSenderId: '766994609429',
    projectId: 'mentorlink-67926',
    authDomain: 'mentorlink-67926.firebaseapp.com',
    storageBucket: 'mentorlink-67926.firebasestorage.app',
  );
}
