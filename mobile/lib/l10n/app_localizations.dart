import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_bn.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('bn'),
    Locale('en')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'MentorLink BD'**
  String get appName;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @signUp.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get signUp;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get name;

  /// No description provided for @university.
  ///
  /// In en, this message translates to:
  /// **'University'**
  String get university;

  /// No description provided for @department.
  ///
  /// In en, this message translates to:
  /// **'Department'**
  String get department;

  /// No description provided for @chooseUniversity.
  ///
  /// In en, this message translates to:
  /// **'Choose your university'**
  String get chooseUniversity;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @mentors.
  ///
  /// In en, this message translates to:
  /// **'Mentors'**
  String get mentors;

  /// No description provided for @plan.
  ///
  /// In en, this message translates to:
  /// **'My plan'**
  String get plan;

  /// No description provided for @jobs.
  ///
  /// In en, this message translates to:
  /// **'Opportunities'**
  String get jobs;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @readiness.
  ///
  /// In en, this message translates to:
  /// **'Readiness'**
  String get readiness;

  /// No description provided for @confidence.
  ///
  /// In en, this message translates to:
  /// **'Confidence'**
  String get confidence;

  /// No description provided for @gaps.
  ///
  /// In en, this message translates to:
  /// **'Skill gaps'**
  String get gaps;

  /// No description provided for @weeksToReady.
  ///
  /// In en, this message translates to:
  /// **'Weeks to ready'**
  String get weeksToReady;

  /// No description provided for @setGoal.
  ///
  /// In en, this message translates to:
  /// **'Set your career goal'**
  String get setGoal;

  /// No description provided for @whyMatch.
  ///
  /// In en, this message translates to:
  /// **'Why this mentor'**
  String get whyMatch;

  /// No description provided for @sendRequest.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get sendRequest;

  /// No description provided for @requests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get requests;

  /// No description provided for @accept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get accept;

  /// No description provided for @decline.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get decline;

  /// No description provided for @chat.
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get chat;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @apply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get apply;

  /// No description provided for @consent.
  ///
  /// In en, this message translates to:
  /// **'I agree to share my name and CV with this poster'**
  String get consent;

  /// No description provided for @report.
  ///
  /// In en, this message translates to:
  /// **'Report this post'**
  String get report;

  /// No description provided for @tracker.
  ///
  /// In en, this message translates to:
  /// **'Application tracker'**
  String get tracker;

  /// No description provided for @campusMap.
  ///
  /// In en, this message translates to:
  /// **'University map'**
  String get campusMap;

  /// No description provided for @directory.
  ///
  /// In en, this message translates to:
  /// **'University directory'**
  String get directory;

  /// No description provided for @privacyNote.
  ///
  /// In en, this message translates to:
  /// **'People appear at their university campus. We never track personal location.'**
  String get privacyNote;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @queue.
  ///
  /// In en, this message translates to:
  /// **'Verification queue'**
  String get queue;

  /// No description provided for @approve.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get approve;

  /// No description provided for @reject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reject;

  /// No description provided for @noFee.
  ///
  /// In en, this message translates to:
  /// **'This post never asks for money'**
  String get noFee;

  /// No description provided for @sourceLabel.
  ///
  /// In en, this message translates to:
  /// **'Posted by'**
  String get sourceLabel;

  /// No description provided for @listingReviewed.
  ///
  /// In en, this message translates to:
  /// **'Listing reviewed'**
  String get listingReviewed;

  /// No description provided for @overview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get overview;

  /// No description provided for @tasksDone.
  ///
  /// In en, this message translates to:
  /// **'Plan progress'**
  String get tasksDone;

  /// No description provided for @showInDirectory.
  ///
  /// In en, this message translates to:
  /// **'Show me in my university directory'**
  String get showInDirectory;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// No description provided for @somethingWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get somethingWrong;

  /// No description provided for @weeklyHours.
  ///
  /// In en, this message translates to:
  /// **'Weekly study hours'**
  String get weeklyHours;

  /// No description provided for @requestTitle.
  ///
  /// In en, this message translates to:
  /// **'Request'**
  String get requestTitle;

  /// No description provided for @yourGoal.
  ///
  /// In en, this message translates to:
  /// **'Your goal'**
  String get yourGoal;

  /// No description provided for @oneQuestion.
  ///
  /// In en, this message translates to:
  /// **'One question'**
  String get oneQuestion;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @requestSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent'**
  String get requestSent;

  /// No description provided for @noMentors.
  ///
  /// In en, this message translates to:
  /// **'No mentors available yet.'**
  String get noMentors;

  /// No description provided for @risingMentor.
  ///
  /// In en, this message translates to:
  /// **'Rising mentor'**
  String get risingMentor;

  /// No description provided for @applied.
  ///
  /// In en, this message translates to:
  /// **'Applied'**
  String get applied;

  /// No description provided for @reportedThanks.
  ///
  /// In en, this message translates to:
  /// **'Reported. Thank you.'**
  String get reportedThanks;

  /// No description provided for @noRequests.
  ///
  /// In en, this message translates to:
  /// **'No requests yet.'**
  String get noRequests;

  /// No description provided for @students.
  ///
  /// In en, this message translates to:
  /// **'Students'**
  String get students;

  /// No description provided for @applications.
  ///
  /// In en, this message translates to:
  /// **'Applications'**
  String get applications;

  /// No description provided for @withdrawn.
  ///
  /// In en, this message translates to:
  /// **'Withdrawn'**
  String get withdrawn;

  /// No description provided for @retryBtn.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retryBtn;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['bn', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'bn':
      return AppLocalizationsBn();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
