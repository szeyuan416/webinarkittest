var wk_date_format_options = { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' };
var wk_reg_options = [];
var wk_reg_intervals = [];
var wk_ty_intervals = [];
var wk_delay = parseInt(document.currentScript.dataset.delay, 10);

function clear_wk_intervals() {
	wk_reg_intervals.forEach((interval_id) => {
		clearInterval(interval_id);
	});

	wk_ty_intervals.forEach((interval_id) => {
		clearInterval(interval_id);
	});
}

function set_wk_elements() {
	clear_wk_intervals();

	set_wk_forms_and_timers();

	set_wk_popup_widget();

	set_wk_wty_session_links();
	
	set_wk_videos();

	if (!window.location.pathname.includes('/embed/form/builder/')) {
		set_wk_buttons();
	}
}

// set webinar registration forms and timers
function set_wk_forms_and_timers() {
	let elements = document.querySelectorAll('[data-wk-webinar-id]');

	let webinar_ids = new Set();

	elements.forEach((element) => {
		webinar_ids.add(element.getAttribute('data-wk-webinar-id'));
	});

	let url_search_params = new URLSearchParams(window.location.search);

	let save_visit;

	try {
		save_visit = get_url_parameter('sv', new URL(document.currentScript.src));
	} catch (error) {
		console.log(error);
	}

	if (save_visit && !document.cookie.includes('wk_webinar_registration=true')) {
		document.cookie = 'wk_webinar_registration=true; expires=' + new Date(Date.now() + 2592000000).toUTCString();

		url_search_params.set('save_visit', true);
	}
	
	webinar_ids.forEach((webinar_id) => {
		if (!webinar_id) {
			return;
		}

		fetch('https://webinarkit.com/webinar/external/registration/' + webinar_id + '?' + url_search_params.toString())
		.then(response => {
			return response.json();
		})
		.then(data => {
			if (data) {
				set_wreg_forms_and_timers_helper(data.webinar);

				set_wty_timers_helper(data.webinar);
			}
		})
		.catch(err => {
			console.log(err);
		});
	});
}

function set_wreg_forms_and_timers_helper(webinar) {
	let presentation_dates = [];
	let blockout_dates = webinar.schedule.blockout_dates;

	let registration_forms = document.querySelectorAll(`.wk_registration_form[data-wk-webinar-id="${webinar.id}"]`);

	let webinar_registration_form_date_selects = [];

	let webinar_registration_form_buttons = [];

	registration_forms.forEach((registration_form) => {
		registration_form.setAttribute('data-wk-enable-instant-watch', webinar.schedule.enableInstantWatch);

		registration_form.setAttribute('data-wk-date-format-type', webinar.schedule.dateFormatType);

		registration_form.querySelectorAll('.wk_registration_form_date').forEach((inner_element) => {
			inner_element.innerHTML = '';

			webinar_registration_form_date_selects.push(inner_element);
		});

		registration_form.querySelectorAll('.wk_button').forEach((inner_element) => {
			webinar_registration_form_buttons.push(inner_element);
		});
	});

	if (webinar.schedule.justInTime) {
		let jit_date;

		if (webinar.schedule.just_in_time_round_to === 'five_minutes') {
			jit_date = round_to_nearest_minute(new Date(), 5);
		} else if (webinar.schedule.just_in_time_round_to === 'ten_minutes') {
			jit_date = round_to_nearest_minute(new Date(), 10);
		} else {
			jit_date = round_to_nearest_minute(new Date(), 15);
		}

		for (let i = 0; i < webinar.schedule.justInTimeNumberOfSessions; i++) {
			let presentation_date = new Date(jit_date);

			presentation_date.wk_redirect_to = webinar.schedule.just_in_time_redirect_to;
			presentation_date.wk_in_progress_label = webinar.schedule.just_in_time_in_progress_label;
			presentation_date.wk_starts_in_label = webinar.schedule.just_in_time_starts_in_label;
			presentation_date.wk_on_demand_session = true;
	
			presentation_dates.push(presentation_date);
	
			jit_date.setMinutes(jit_date.getMinutes() + webinar.schedule.justInTimeSessionsTimeBetween);
		}
	}

	let webinar_dates = webinar.schedule.webinarDates;

	let event_duration = webinar.videoDuration ? webinar.videoDuration : 30;
	let series_duration = webinar.series_duration ? webinar.series_duration : -1; // If the event is part of a series, the series duration will exist. We use the series duration to allow joining of in progress series
	let duration_ms = (series_duration > 0 ? series_duration : event_duration) * 60 * 1000;

	for (let i = 0; i < webinar_dates.length; i++) {
		presentation_dates = presentation_dates.concat(get_presentation_date(webinar_dates[i], duration_ms));
	}

	presentation_dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
	presentation_dates = presentation_dates.filter(date => !blockout_dates.some(blocked_date => is_date_blocked(date, blocked_date)));

	let enable_instant_watch = webinar.schedule.enableInstantWatch;
    let instant_watch_only_if_no_sessions = webinar.schedule.instant_watch_only_if_no_sessions;
    let now = new Date();
    let is_now_blocked = blockout_dates.some((date) => is_date_blocked(now, date));

    webinar.schedule.show_instant_watch = enable_instant_watch && ((instant_watch_only_if_no_sessions && presentation_dates.length === 0) || (!instant_watch_only_if_no_sessions && !is_now_blocked));

	if (webinar.schedule.show_instant_watch) {
		let option = document.createElement('option');
	
		option.value = JSON.stringify({
			date: 'instant_watch',
			redirect_to: webinar.schedule.instant_watch_redirect_to
		});

		option.text = webinar.schedule.instant_watch_label;
	
		webinar_registration_form_date_selects.forEach(function(element) {
			element.add(option.cloneNode(true));
		});
	}

	let closest_date;

	for (let i = 0; i < presentation_dates.length; i++) {
		let event_date = new Date(presentation_dates[i]);
  
		let option = document.createElement('option');
  
		option.value = event_date;
  
		option.value = JSON.stringify({
			date: event_date,
			redirect_to: presentation_dates[i].wk_redirect_to,
			in_progress_label: presentation_dates[i].wk_in_progress_label || '',
        	starts_in_label: presentation_dates[i].wk_starts_in_label || '',
			on_demand_session: presentation_dates[i].wk_on_demand_session ? true : false
		})
  
		format_registration_option_text(option, webinar.schedule.dateFormatType);
  
		if (!closest_date) { // make the soonest occuring event in the dropdown the selected option
			option.selected = true;
	
			closest_date = event_date;
		}
  
		webinar_registration_form_date_selects.forEach(function(element) {
			let registration_form = element.closest('.wk_registration_form');

			let number_of_sessions_to_show = registration_form.getAttribute('data-wk-number-of-sessions-to-show');

			if (!number_of_sessions_to_show || number_of_sessions_to_show === 'all' || element.options.length < parseInt(number_of_sessions_to_show)) {
				let clone = option.cloneNode(true);

				wk_reg_options.push(clone);

				element.add(clone);
			}
		});
	}

	let registration_timers = document.querySelectorAll(`.wk_registration_timer[data-wk-webinar-id="${webinar.id}"]`);

	if (closest_date || webinar.schedule.show_instant_watch) { // session available
		webinar_registration_form_date_selects.forEach(function (element) {
			element.style.display = null;
			element.parentElement.style.marginBottom = null;
		});

		// register buttons
		webinar_registration_form_buttons.forEach(function(element) {
			element.disabled = false;
		});

		if (webinar.schedule.show_instant_watch) { // instant watch
			registration_timers.forEach(function (element) {
				element.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
					inner_element.style.display = null;
					inner_element.innerHTML = element.getAttribute('data-wk-instant-watch-text');
				});

				element.querySelectorAll('.wk_timer_row').forEach(function (inner_element) {
					inner_element.style.display = 'none';
				});

				calendar_card_helper(element, new Date(), webinar.schedule.dateFormatType);
			});

			wk_reg_intervals.push(setInterval(function () {
				wk_reg_options.forEach(function(option) {
					if (document.activeElement !== option.parentElement) {
					  	format_registration_option_text(option, webinar.schedule.dateFormatType);
					}
				});
			}, 1000));
		} else { // regular sessions
			registration_timers.forEach(function (element) {
				element.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
					inner_element.style.display = null;
					inner_element.innerHTML = element.getAttribute('data-wk-next-session-text');
				});

				element.querySelectorAll('.wk_timer_row').forEach(function (inner_element) {
					inner_element.style.display = null;
				});

				element.querySelectorAll('.wk_timer_days_label').forEach(function (inner_element) {
					inner_element.innerHTML = element.getAttribute('data-wk-days-label');
				});

				element.querySelectorAll('.wk_timer_hours_label').forEach(function (inner_element) {
					inner_element.innerHTML = element.getAttribute('data-wk-hours-label');
				});

				element.querySelectorAll('.wk_timer_minutes_label').forEach(function (inner_element) {
					inner_element.innerHTML = element.getAttribute('data-wk-minutes-label');
				});

				element.querySelectorAll('.wk_timer_seconds_label').forEach(function (inner_element) {
					inner_element.innerHTML = element.getAttribute('data-wk-seconds-label');
				});

				// calendar card
				calendar_card_helper(element, closest_date, webinar.schedule.dateFormatType);
			});

			update_registration_timer(webinar, registration_timers, closest_date, duration_ms);

			wk_reg_intervals.push(setInterval(function () {
				update_registration_timer(webinar, registration_timers, closest_date, duration_ms);

				wk_reg_options.forEach(function(option) {
					if (document.activeElement !== option.parentElement) {
					  	format_registration_option_text(option, webinar.schedule.dateFormatType);
					}
				});
			}, 1000));
		}
	} else { // session not available
		webinar_registration_form_buttons.forEach(function(element) {
			element.disabled = true;
		});

		registration_timers.forEach(function (element) {
			element.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
				inner_element.style.display = null;
				inner_element.innerHTML = 'Sorry, there are no available sessions for this webinar.'
			});

			element.querySelectorAll('.wk_timer_row').forEach(function (inner_element) {
				inner_element.style.display = 'none';
			});

			calendar_card_helper(element, new Date(), webinar.schedule.dateFormatType);
		});
	}

	document.querySelectorAll('.wk_registration_form_phone:not(.wk_registration_form_phone_container *)').forEach(function(element) {
		let display_class = '';
  
		if (element.classList.contains('d-none')) {
		  display_class = display_class + ' d-none';
		}

		window.intlTelInput(element, {
			utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js',
			autoPlaceholder: 'off',
			initialCountry: 'auto',
			containerClass: 'wk_registration_form_phone_container' + display_class,
			geoIpLookup: function(callback) {
				fetch('https://webinarkit.com/country/code/lookup')
				.then(function(res) { return res.json(); })
				.then(function(data) { callback(data.country_code); })
				.catch(function(error) { callback(); });
			}
		});

		element.closest('.iti.iti--allow-dropdown').classList.add('wk_registration_form_phone_container'); // HighLevel specific fix because conflict prevents containerClass from being applied
	});
}

function calendar_card_helper(element, date, date_format_type) {
    element.querySelectorAll('.wk_calendar_month').forEach(function(inner_element) {
      inner_element.innerHTML = date.toLocaleString(date_format_type, { month: 'long' });
    });

    element.querySelectorAll('.wk_calendar_day').forEach(function(inner_element) {
      inner_element.innerHTML = date.toLocaleString(date_format_type, { day: 'numeric' });
    });

    element.querySelectorAll('.wk_calendar_time').forEach(function(inner_element) {
      inner_element.innerHTML = ' ' + date.toLocaleString(date_format_type, { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' });
    });
  }

function update_registration_timer(webinar, registration_timers, closest_date, duration_ms) {
	let wk_count_down_date = new Date(closest_date.getTime());

	var distance = wk_count_down_date.getTime() - Date.now();
	var days = Math.floor(distance / (1000 * 60 * 60 * 24));
	var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
	var seconds = Math.floor((distance % (1000 * 60)) / 1000);

	if (distance < 0) {
		wk_count_down_date.setTime(wk_count_down_date.getTime() + duration_ms);

		registration_timers.forEach(function(registration_timer) {
			registration_timer.querySelectorAll('.wk_timer_header').forEach(function(inner_element) {
				inner_element.innerHTML = closest_date.toLocaleDateString(webinar.schedule.dateFormatType, wk_date_format_options) + ' ' + registration_timer.getAttribute('data-wk-in-progress-text');
			});

			registration_timer.querySelectorAll('.wk_timer_row').forEach(function(inner_element) {
				inner_element.style.display = 'none';
			});
		});

		let distance = wk_count_down_date.getTime() - Date.now();

		if (distance < 0) {
			clear_wk_intervals();

			set_wk_forms_and_timers();
		}
	} else {
		registration_timers.forEach(function(registration_timer) {
			registration_timer.querySelectorAll('.wk_timer_days').forEach(function(inner_element) {
				inner_element.textContent = days;
			});

			registration_timer.querySelectorAll('.wk_timer_hours').forEach(function(inner_element) {
				inner_element.textContent = hours;
			});

			registration_timer.querySelectorAll('.wk_timer_minutes').forEach(function(inner_element) {
				inner_element.textContent = minutes;
			});

			registration_timer.querySelectorAll('.wk_timer_seconds').forEach(function(inner_element) {
				inner_element.textContent = seconds;
			});
		});
	}
}

function format_registration_option_text(option, date_format_type) {
    let date_value = JSON.parse(option.value);

    let event_date = new Date(date_value.date);
    let starts_in_label = date_value.starts_in_label;
    let in_progress_label = date_value.in_progress_label;

    let difference_in_ms = event_date.getTime() - Date.now();

    if (difference_in_ms > 86400000) { // greater than 24 hours
		let days = Intl.NumberFormat(date_format_type, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(Math.floor(difference_in_ms / 86400000));
		let hours = Intl.NumberFormat(date_format_type, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(Math.floor(difference_in_ms / 3600000) % 24);

		option.text = event_date.toLocaleDateString(date_format_type, wk_date_format_options) + starts_in_label.replace('{{time}}', days + ' ' + hours);
    } else if (difference_in_ms > 3600000) {
		let hours = Intl.NumberFormat(date_format_type, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(Math.floor(difference_in_ms / 3600000));
		let minutes = Intl.NumberFormat(date_format_type, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(Math.ceil(difference_in_ms / 60000) % 60);

		option.text = event_date.toLocaleDateString(date_format_type, wk_date_format_options) + starts_in_label.replace('{{time}}', hours + ' ' + minutes);
    } else if (difference_in_ms >= 0) {
      	let minutes = Intl.NumberFormat(date_format_type, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(Math.ceil(difference_in_ms / 60000));

      	option.text = event_date.toLocaleDateString(date_format_type, wk_date_format_options) + starts_in_label.replace('{{time}}', minutes);
    } else if (difference_in_ms < 0) {
      	option.text = event_date.toLocaleDateString(date_format_type, wk_date_format_options) + in_progress_label;
    }
}

function round_to_nearest_minute(date, minutes) {
	let ms = 1000 * 60 * minutes;
	return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function get_presentation_date(webinarDate, duration) {
	let presentation_dates = [];

	let [hours, minutes] = webinarDate.time.split(':');

    if (hours === '12') {
      hours = '00';
    }

    if (webinarDate.period === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }

	if (webinarDate.type === 'ongoing') {
		let temp_date;

		const fill_dates = (interval) => { // "fill" dates from starting date to until we have a date that is in the future
			add_date();

			while (Date.now() > temp_date.getTime()) {
				temp_date.setDate(temp_date.getDate() + interval);

				add_date();
			}
		}

		const add_date = () => {
			let presentation_date = new Date(temp_date);

			let end_of_presentation_date = new Date(presentation_date);

			end_of_presentation_date.setTime(end_of_presentation_date.getTime() + duration);

			if (end_of_presentation_date.getTime() > Date.now()) {
				presentation_date.wk_in_progress_label = webinarDate.in_progress_label;
				presentation_date.wk_starts_in_label = webinarDate.starts_in_label;
				presentation_date.wk_redirect_to = webinarDate.redirect_to;

				if (webinarDate.allow_join_in_progress || presentation_date.getTime() > Date.now()) {
					presentation_dates.push(presentation_date);
				}
			}
		};

		let starting_day = new Date();

		starting_day.setTime(starting_day.getTime() - duration);

		if (webinarDate.day === 'Day') {
			// When the Temporal proposal goes live, remove Luxon from codebase and use code similar to below
			//- let zoned_date_time = Temporal.Now.zonedDateTimeISO().withTimeZone(webinarDate.timeZone);
			//- zoned_date_time = zoned_date_time.withPlainTime({ hour: hours, minute: minutes, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
			//- temp_date = new Date(zoned_date_time.epochMilliseconds);

			let date_time = luxon.DateTime.now().setZone(webinarDate.timeZone);
			date_time = date_time.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

			temp_date = date_time.toJSDate();

			fill_dates(1);
		} else {
			let dow = 0;

			if (webinarDate.day === 'Monday') {
				dow = 1;
			} else if (webinarDate.day === 'Tuesday') {
				dow = 2;
			} else if (webinarDate.day === 'Wednesday') {
				dow = 3;
			} else if (webinarDate.day === 'Thursday') {
				dow = 4;
			} else if (webinarDate.day === 'Friday') {
				dow = 5;
			} else if (webinarDate.day === 'Saturday') {
				dow = 6;
			} else if (webinarDate.day === 'Sunday') {
				dow = 0;
			}

			// When the Temporal proposal goes live, remove Luxon from codebase and use code similar to below
			//- let zoned_date_time = Temporal.Now.zonedDateTimeISO().withTimeZone(webinarDate.timeZone);
			//- zoned_date_time = zoned_date_time.add({ days: (7 + dow - zoned_date_time.dayOfWeek) % 7 });
			//- zoned_date_time = zoned_date_time.withPlainTime({ hour: hours, minute: minutes, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
			//- temp_date = new Date(zoned_date_time.epochMilliseconds);

			let date_time = luxon.DateTime.now().setZone(webinarDate.timeZone);
			date_time = date_time.plus({ days: (7 + dow - date_time.weekday) % 7 });
			date_time = date_time.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

			temp_date = date_time.toJSDate();

			fill_dates(7);
		}

		if (webinarDate.numberOfSessions && webinarDate.numberOfSessions > 1) {
			let i = 0;

			while (i < webinarDate.numberOfSessions - 1 || presentation_dates.length < webinarDate.numberOfSessions) {
				temp_date.setDate(temp_date.getDate() + (webinarDate.day === 'Day' ? 1 : 7));

				let presentation_date = new Date(temp_date);

				presentation_date.wk_in_progress_label = webinarDate.in_progress_label;
				presentation_date.wk_starts_in_label = webinarDate.starts_in_label;
				presentation_date.wk_redirect_to = webinarDate.redirect_to;

				presentation_dates.push(presentation_date);

				i++;
			}
		}

		return presentation_dates;
	} else {
		// When the Temporal proposal goes live, remove Luxon from codebase and use code similar to below
		//- let zoned_date_time = Temporal.PlainDate.from(webinarDate.day).toZonedDateTime(webinarDate.timeZone);
		//- zoned_date_time = zoned_date_time.withPlainTime({ hour: hours, minute: minutes, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
		//- let presentation_date = new Date(zoned_date_time.epochMilliseconds);

		let date_time = luxon.DateTime.fromFormat(webinarDate.day, 'yyyy-MM-dd', {zone: webinarDate.timeZone});
      	date_time = date_time.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

		let presentation_date = date_time.toJSDate();
		let end_of_presentation_date = new Date(presentation_date);

		end_of_presentation_date.setTime(end_of_presentation_date.getTime() + duration);

		if (end_of_presentation_date.getTime() > Date.now()) {
			presentation_date.wk_in_progress_label = webinarDate.in_progress_label;
			presentation_date.wk_starts_in_label = webinarDate.starts_in_label;
			presentation_date.wk_redirect_to = webinarDate.redirect_to;

			if (webinarDate.allow_join_in_progress || presentation_date.getTime() > Date.now()) {
				presentation_dates.push(presentation_date);
			}
		}

		return presentation_dates;
	}
}

function is_date_blocked(date, schedule) {
	let date_time = luxon.DateTime.fromJSDate(date, { zone: schedule.time_zone }); // Convert the date to the timezone of the blockout schedule

	if (schedule.type === 'ongoing') {
		let target_days = [];

		switch (schedule.day) {
			case 'Day':
				target_days = [1, 2, 3, 4, 5, 6, 7];
				break;
			case 'Weekday':
				target_days = [1, 2, 3, 4, 5];
				break;
			case 'Weekend':
				target_days = [6, 7];
				break;
			case 'Monday':
				target_days = [1];
				break;
			case 'Tuesday':
				target_days = [2];
				break;
			case 'Wednesday':
				target_days = [3];
				break;
			case 'Thursday':
				target_days = [4];
				break;
			case 'Friday':
				target_days = [5];
				break;
			case 'Saturday':
				target_days = [6];
				break;
			case 'Sunday':
				target_days = [7];
				break;
		}

		if (!target_days.includes(date_time.weekday)) {
			return false;
		}

		let [start_hours, start_minutes] = schedule.start_time.split(':');

		if (start_hours === '12') {
			start_hours = '00';
		}

		if (schedule.start_period === 'PM') {
			start_hours = parseInt(start_hours, 10) + 12;
		}

		start_minutes = start_hours * 60 + parseInt(start_minutes, 10);


		let [end_hours, end_minutes] = schedule.end_time.split(':');

		if (end_hours === '12') {
			end_hours = '00';
		}

		if (schedule.end_period === 'PM') {
			end_hours = parseInt(end_hours, 10) + 12;
		}

		end_minutes = end_hours * 60 + parseInt(end_minutes, 10);


		let current_minutes = date_time.hour * 60 + date_time.minute;

		if (current_minutes >= start_minutes && current_minutes <= end_minutes) {
			return true;
		}

		return false;
	} else {
		let [start_hours, start_minutes] = schedule.start_time.split(':');

		if (start_hours === '12') {
			start_hours = '00';
		}

		if (schedule.start_period === 'PM') {
			start_hours = parseInt(start_hours, 10) + 12;
		}

		let start_date_time = luxon.DateTime.fromFormat(schedule.start_date, 'yyyy-MM-dd', { zone: schedule.time_zone });
		start_date_time = start_date_time.set({ hour: start_hours, minute: start_minutes, second: 0, millisecond: 0 });


		let [end_hours, end_minutes] = schedule.end_time.split(':');

		if (end_hours === '12') {
			end_hours = '00';
		}

		if (schedule.end_period === 'PM') {
			end_hours = parseInt(end_hours, 10) + 12;
		}

		let end_date_time = luxon.DateTime.fromFormat(schedule.end_date, 'yyyy-MM-dd', { zone: schedule.time_zone });
		end_date_time = end_date_time.set({ hour: end_hours, minute: end_minutes, second: 0, millisecond: 0 });


		return date_time.toMillis() >= start_date_time.toMillis() && date_time.toMillis() <= end_date_time.toMillis();
	}
}

function webinar_registration_submit(event) {
	event.preventDefault();

	let registration_form = event.target.closest('.wk_registration_form');
	let form_element = registration_form.querySelector('.wk_registration_form_element');
	let first_name = registration_form.querySelector('.wk_registration_form_first_name');
	let last_name = registration_form.querySelector('.wk_registration_form_last_name');
	let email = registration_form.querySelector('.wk_registration_form_email');
	let phone = registration_form.querySelector('.wk_registration_form_phone');
	let custom_field_1 = registration_form.querySelector('.wk_registration_form_custom_field_1');
	let custom_field_2 = registration_form.querySelector('.wk_registration_form_custom_field_2');
	let custom_field_3 = registration_form.querySelector('.wk_registration_form_custom_field_3');
	let custom_field_4 = registration_form.querySelector('.wk_registration_form_custom_field_4');
	let custom_field_5 = registration_form.querySelector('.wk_registration_form_custom_field_5');
	let custom_field_6 = registration_form.querySelector('.wk_registration_form_custom_field_6');
	let date_select = registration_form.querySelector('.wk_registration_form_date');

	let webinar_id = registration_form.getAttribute('data-wk-webinar-id');

	if (!webinar_id) {
		return;
	}

	if (!form_element.checkValidity()) {
		return form_element.reportValidity();
	}

	let iti = window.intlTelInputGlobals.getInstance(phone);

	if (phone.value && !iti.isValidNumber()) {
		phone.setCustomValidity('Please enter a valid phone number');
  
		return form_element.reportValidity();
	}

	let redirect_to = "";

	let long_options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' };

	let date_format_type = registration_form.getAttribute('data-wk-date-format-type');

	let date = "2025-02-03"
	let date_text = "2025-02-03"

	let on_demand_session = date_select_value.on_demand_session;

	if (date === 'instant_watch') {
		let now = new Date();
		date = now.toISOString();
		date_text = now.toLocaleDateString(date_format_type, long_options);
		on_demand_session = true;
	}

	let phone_number_country_code_value = '+' + iti.getSelectedCountryData().dialCode;
	let phone_number_value = iti.getNumber().replace(phone_number_country_code_value, '');

	let body = {
		firstName: first_name ? first_name.value : '',
		lastName: last_name ? last_name.value : '',
		email: email ? email.value : '',
		phoneNumberCountryCode: phone_number_country_code_value,
		phoneNumber: phone_number_value,
		customField1: custom_field_1 ? custom_field_1.value : '',
		customField2: custom_field_2 ? custom_field_2.value : '',
		customField3: custom_field_3 ? custom_field_3.value : '',
		customField4: custom_field_4 ? custom_field_4.value : '',
		customField5: custom_field_5 ? custom_field_5.value : '',
		customField6: custom_field_6 ? custom_field_6.value : '',
		date: date,
      	fullDate: date_text,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		redirect_to: redirect_to,
		on_demand_session: on_demand_session,
      	referrer: document.referrer
	};

	let wk_enable_captcha = registration_form.getAttribute('wk-data-enable-captcha');

	let wk_captcha_site_key = registration_form.getAttribute('wk-data-captcha-site-key');

	wk_captcha_site_key = wk_captcha_site_key ? wk_captcha_site_key : '6LdWrJYjAAAAAI2JhwdDzpGLd5Og_2gCKChWja9E';

	if (wk_enable_captcha) {
		grecaptcha.ready(function() {
		grecaptcha.execute(wk_captcha_site_key, { action: 'submit' }).then(function(token) {
			body.recaptcha_token = token;
			webinarkit_post_registration(webinar_id, body);
		});
		});
	} else {
		webinarkit_post_registration(webinar_id, body);
	}
}

function webinarkit_post_registration(id, body) {
	let post_url = 'https://webinarkit.com/webinar/external/registration/' + id;

	let url_search_params = new URLSearchParams(window.location.search);

    let query = url_search_params.toString();

    if (query) {
      post_url = post_url + '?' + query;
    }

	fetch(post_url, {
		method: 'POST',
		headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	})
	.then(response => {
		return response.json();
	})
	.then(data => {
		if (data) {
			window.top.location.href = data.url;
		}
	})
	.catch(err => {
		console.log(err);
	});
}

function set_wk_popup_widget() {
    let popup_widget = document.querySelector('.wk_popup_widget');

    if (!popup_widget) {
      return;
    }

    popup_widget.style.display = null;

    let wk_popup_widget_expanded = document.querySelector('.wk_popup_widget_expanded');
    let wk_popup_widget_minimized = document.querySelector('.wk_popup_widget_minimized');
    let wk_reset_popup_widget_button = document.querySelector('.wk_reset_popup_widget_button');

    wk_popup_widget_expanded.style.display = 'block';
    wk_popup_widget_minimized.style.display = 'none';

    let minimize_button = document.querySelector('.wk_popup_widget_minimize_button');

    let minimize_button_behavior = popup_widget.getAttribute('data-wk-min-button-behavior');

    if (minimize_button_behavior === 'collapse_widget') {
		minimize_button.style.display = 'flex';

		minimize_button.onclick = (event) => {
			event.stopPropagation();

			wk_popup_widget_expanded.style.display = 'none';
			wk_popup_widget_minimized.style.display = null;

			if (wk_reset_popup_widget_button) {
				wk_reset_popup_widget_button.classList.remove('d-none');
			}
		};
    } else if (minimize_button_behavior === 'hide_widget') {
		minimize_button.style.display = 'flex';

		minimize_button.onclick = (event) => {
			event.stopPropagation();

			wk_popup_widget_expanded.style.display = 'none';

			if (wk_reset_popup_widget_button) {
				wk_reset_popup_widget_button.classList.remove('d-none');
			}
		};
    } else {
      	minimize_button.style.display = 'none';
    }
}

//thank you
function get_url_parameter(name, url) {
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	var results;
	if (url) {
		results = regex.exec(url);
	} else {
		results = regex.exec(location.search);
	}
	return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

var wk_time = get_url_parameter('t');
var wk_registrant_id = get_url_parameter('r');
var wk_ty_interval;

// set webinar thank you timers
function set_wty_timers_helper(webinar) {
	// clearInterval(wk_ty_interval);

	if (webinar.series_time_override) {
		wk_time = webinar.series_time_override;
    	wk_registrant_id = webinar.series_registrant_id_override;
	}

	let count_down_date = new Date();
	count_down_date.setTime(parseInt(wk_time, 10));

	if (isNaN(count_down_date.getTime())) {
		return;
	}

	let thank_you_timers = document.querySelectorAll(`.wk_thank_you_timer[data-wk-webinar-id="${webinar.id}"]`);

	if (!thank_you_timers || thank_you_timers.length < 1) {
		return;
	}

	thank_you_timers.forEach(function(thank_you_timer) {
		thank_you_timer.setAttribute('data-wk-date-format-type', webinar.schedule.dateFormatType);

		thank_you_timer.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
			inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-starts-in-label');
		});

		thank_you_timer.querySelectorAll('.wk_timer_row').forEach(function(inner_element) {
			inner_element.style.display = null;
		});

		thank_you_timer.querySelectorAll('.wk_timer_days_label').forEach(function (inner_element) {
			inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-days-label');
		});

		thank_you_timer.querySelectorAll('.wk_timer_hours_label').forEach(function (inner_element) {
			inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-hours-label');
		});

		thank_you_timer.querySelectorAll('.wk_timer_minutes_label').forEach(function (inner_element) {
			inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-minutes-label');
		});

		thank_you_timer.querySelectorAll('.wk_timer_seconds_label').forEach(function (inner_element) {
			inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-seconds-label');
		});

		thank_you_timer.querySelectorAll('.wk_calendar_month').forEach(function (inner_element) {
			inner_element.innerHTML = count_down_date.toLocaleString(webinar.schedule.dateFormatType, { month: 'long' });
		});

		thank_you_timer.querySelectorAll('.wk_calendar_day').forEach(function (inner_element) {
			inner_element.innerHTML = count_down_date.toLocaleString(webinar.schedule.dateFormatType, { day: 'numeric' });
		});

		thank_you_timer.querySelectorAll('.wk_calendar_time').forEach(function (inner_element) {
			inner_element.innerHTML = ' ' + count_down_date.toLocaleString(webinar.schedule.dateFormatType, { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' });
		});
	});

	update_thank_you_timer(webinar, thank_you_timers, count_down_date);

	wk_ty_intervals.push(setInterval(function () {
		update_thank_you_timer(webinar, thank_you_timers, count_down_date);
	}, 1000));
}

function update_thank_you_timer(webinar, thank_you_timers, date) {
	let count_down_date = new Date(date.getTime());
	let distance = count_down_date.getTime() - Date.now();
	let days = Math.floor(distance / (1000 * 60 * 60 * 24));
	let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
	let seconds = Math.floor((distance % (1000 * 60)) / 1000);
	if (distance < 0) {
		clear_wk_intervals();

		let duration_ms = (webinar.videoDuration ? webinar.videoDuration : 30) * 60 * 1000;

		if (Date.now() > count_down_date.getTime() + duration_ms) {
			thank_you_timers.forEach(function (thank_you_timer) {
				thank_you_timer.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
					inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-expired-label');
				});
	
				thank_you_timer.querySelectorAll('.wk_timer_row').forEach(function (inner_element) {
					inner_element.style.display = 'none';
				});
			});
		} else {
			thank_you_timers.forEach(function (thank_you_timer) {
				thank_you_timer.querySelectorAll('.wk_timer_header').forEach(function (inner_element) {
					inner_element.innerHTML = thank_you_timer.getAttribute('data-wk-entering-label');
				});
	
				thank_you_timer.querySelectorAll('.wk_timer_row').forEach(function (inner_element) {
					inner_element.style.display = 'none';
				});
			});

			let url_search_params = new URLSearchParams(window.location.search);
			url_search_params.delete('r');
			url_search_params.delete('t');
			url_search_params.delete('e');

			let query = url_search_params.toString();

			if (query) {
				query = '&' + query;
			}
	
			if (webinar.custom_watch_room_url) {
				window.top.location.href = webinar.custom_watch_room_url + `?t=` + wk_time + '&r=' + wk_registrant_id + query;
			} else {
				window.top.location.href = webinar.domain_prefix + `/webinar/watch/` + webinar.id + `?t=` + wk_time + '&r=' + wk_registrant_id + query;
			}
		}
	} else {
		thank_you_timers.forEach(function (thank_you_timer) {
			thank_you_timer.querySelectorAll('.wk_timer_days').forEach(function (inner_element) {
				inner_element.textContent = days;
			});

			thank_you_timer.querySelectorAll('.wk_timer_hours').forEach(function (inner_element) {
				inner_element.textContent = hours;
			});

			thank_you_timer.querySelectorAll('.wk_timer_minutes').forEach(function (inner_element) {
				inner_element.textContent = minutes;
			});

			thank_you_timer.querySelectorAll('.wk_timer_seconds').forEach(function (inner_element) {
				inner_element.textContent = seconds;
			});
		});
	}
}

// set webinar thank you session links
function set_wk_wty_session_links() {
	document.querySelectorAll('.wk_thank_you_session_link').forEach((element) => {
		let webinar_session_link = element.querySelector('.wk_webinar_session_link');

		let copy_link_button = element.querySelector('.wk_copy_link_button');

		webinar_session_link.value = window.location.href;

		copy_link_button.onclick = () => {
			navigator.clipboard.writeText(webinar_session_link.value);

			let icon = copy_link_button.querySelector('.far');

			icon.classList.remove('fa-copy');

			icon.classList.add('fa-check');

			setTimeout(() => {
				icon.classList.remove('fa-check');

				icon.classList.add('fa-copy');	
			}, 1000);
		};
	});
}

// set webinar thank you calendar and social links
// function set_wty_calendar_and_social_links() {
// 	document.querySelectorAll('.wk_thank_you_calendar_links').forEach((element) => {
// 		if (!wk_time) {
// 			return;
// 		}

// 		let calendar_date = new Date();

// 		calendar_date = new Date();
// 		calendar_date.setTime(parseInt(wk_time, 10));

// 		let google_date_1 = calendar_date.toISOString().split('.')[0] + 'Z';
// 		google_date_1 = google_date_1.replaceAll('-', '');
// 		google_date_1 = google_date_1.replaceAll(':', '');

// 		calendar_date.setMinutes(calendar_date.getMinutes() + 60);

// 		let google_date_2 = calendar_date.toISOString().split('.')[0] + 'Z';
// 		google_date_2 = google_date_2.replaceAll('-', '');
// 		google_date_2 = google_date_2.replaceAll(':', '');

// 		calendar_date.setTime(parseInt(wk_time, 10));
// 		calendar_date.setUTCHours(calendar_date.getHours());

// 		let outlook_date_1 = calendar_date.toISOString().split('.')[0];
// 		outlook_date_1 = outlook_date_1.replaceAll(':', '%3A');

// 		calendar_date.setMinutes(calendar_date.getMinutes() + 60);

// 		let outlook_date_2 = calendar_date.toISOString().split('.')[0];
// 		outlook_date_2 = outlook_date_2.replaceAll(':', '%3A');

// 		let google_calendar_link = 'https://calendar.google.com/calendar/render?action=TEMPLATE&dates=' + google_date_1 + '%2F' + google_date_2 + '&text=' + encodeURIComponent(`#{webinar.title}`) + '&details=' + encodeURIComponent(`Webinar: #{webinar.title}\n\nWebinar session link: https://` + location.host + `/webinar/thankyou/#{webinar.id}?t=#{presentationDate}&r=#{registrantID}`);
// 		let outlook_calendar_link = 'https://outlook.live.com/calendar/0/deeplink/compose?enddt=' + outlook_date_2 + '&startdt=' + outlook_date_1 + '&subject=' + encodeURIComponent(`#{webinar.title}`) + '&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent' + '&body=' + encodeURIComponent(`Webinar: #{webinar.title}\n\nWebinar session link: https://` + location.host + `/webinar/thankyou/#{webinar.id}?t=#{presentationDate}&r=#{registrantID}`);

// 		document.querySelectorAll('.wk_google_calendar_link').forEach((inner_element) => {
// 			inner_element.href = google_calendar_link;
// 		});

// 		document.querySelectorAll('.wk_outlook_calendar_link').forEach((inner_element) => {
// 			inner_element.href = outlook_calendar_link;
// 		});
// 	});

// 	document.querySelectorAll('.wk_thank_you_social_links').forEach((element) => {
// 		let webinar_id = element.getAttribute('data-wk-webinar-id');

// 		let webinar_title = element.getAttribute('data-wk-webinar-title');

// 		let facebook_link = `https://facebook.com/sharer/sharer.php?u=https://` + location.host + `/webinar/registration/` + webinar_id + '&quote=' + webinar_title

// 		let twitter_link = `https://twitter.com/share?url=https://` + location.host + `/webinar/registration/` + webinar_id + '&text=' + webinar_title

// 		document.querySelectorAll('.wk_facebook_link').forEach((inner_element) => {
// 			inner_element.setAttribute('onclick', 'window.open("' + facebook_link + '", "popup","width=600,height=600"); return false;');
// 		});

// 		document.querySelectorAll('.wk_twitter_link').forEach((inner_element) => {
// 			inner_element.setAttribute('onclick', 'window.open("' + twitter_link + '", "popup","width=600,height=600"); return false;');
// 		});
// 	});
// }

function set_wk_videos() {
	let wk_videos = document.getElementsByClassName('wk_video');

	for (let i = 0; i < wk_videos.length; i++) {
		set_wk_video(wk_videos[i]);
	}
}

function set_wk_video(element) {
	element.innerHTML = '';

	let url;

	let video_source_type = element.getAttribute('video_source_type');

	if (video_source_type === 'upload' || video_source_type === 'recording') {
		let video_id = element.getAttribute('video_id');

		if (!video_id) {
			url = '';
		} else {
			url = 'https://vz-3f780a95-e11.b-cdn.net/' + video_id + '/playlist.m3u8';
		}
	} else if (video_source_type === 'url') {
		url = element.getAttribute('video_url');
	}

	if (url) {
		url = url + '#t=0.001';
	}

	let video = document.createElement('video');

	element.appendChild(video);

	video.classList.add('video-js', 'vjs-fluid');
	video.setAttribute('preload', 'auto');
	video.setAttribute('playsinline', 'true');

	let player = videojs(video);

	player.src([{
        src: url,
        type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
	}]);

	player.on('ready', function () {
		// player.poster('/img/media_background.mp4');
		//- video.poster = '/img/media_background.mp4';

		player.controls(true);
	});

	player.on('error', function(event) {
        this.error(null);

        if (video_source_type === 'upload' || video_source_type === 'recording') {
        	player.createModal('Whoops! This video may still be processing or there may be an issue with the video. Please try again later or contact support.');
        } else {
        	player.createModal('Whoops! There may be an issue with the video or video link. Please try again later or contact support.');
        }
	});
}

var modal_content_clicked;

function set_wk_buttons() {
	document.querySelectorAll('.wk_button').forEach(function(element) {
		let link = element.getAttribute('data-wk-button-link');
	
		let modal_container_id = element.getAttribute('data-wk-modal-id');
	
		if (link) {
		  	element.setAttribute('onclick', 'window.open("'+ link + '", "_blank");');
		} else if (modal_container_id) {
			let modal_container = document.getElementById(modal_container_id);

			if (!modal_container) {
				return;
			}
		
			element.onclick = function() {
				modal_container.style.top = 0;

				modal_container.style.position = 'fixed';

				modal_container.style.display = 'block';
		
				setTimeout(() => { modal_container.classList.add('opacity-1'); }, 100);
		
				document.documentElement.classList.add('wk_external_overflow_hidden');
			}

			let modal_content = modal_container.querySelector('.wk_modal_content');

			modal_content.onmousedown = function(event) {
				modal_content_clicked = true;
			};

			modal_content.onclick = function(event) {
				modal_content_clicked = false;
			};
		
			modal_container.onclick = function(event) {
				if (modal_content_clicked) {
					modal_content_clicked = false;

					return;
				}

				if (!event.target.classList.contains('wk_modal_container')) {
					return;
				}

				modal_container.classList.remove('opacity-1');
		
				setTimeout(() => { modal_container.style.display = 'none'; }, 500);
		
				document.documentElement.classList.remove('wk_external_overflow_hidden');

				modal_content_clicked = false;
			}
		}
	});
}

function wk_input_change(element) {
	let parent = element.closest('.wk_registration_form');
	let email = parent.querySelector('.wk_registration_form_email');
	let phone = parent.querySelector('.wk_registration_form_phone');

	phone.setCustomValidity('');

	let registration_form_checkbox = parent.querySelector('.wk_registration_form_checkbox[data-wk-show-checkbox="true"]');

	if (!registration_form_checkbox) {
		return;
	}

	let show_on_email = registration_form_checkbox.getAttribute('data-wk-show-checkbox-if-email');
	let show_on_phone = registration_form_checkbox.getAttribute('data-wk-show-checkbox-if-phone');
	let checkbox_input = registration_form_checkbox.querySelector('.wk_checkbox_input');

	if (!show_on_email && !show_on_phone) {
		registration_form_checkbox.classList.remove('d-none');
		checkbox_input.required = true;

		return;
	}

	if (show_on_email) {
		if (email.value) {
			registration_form_checkbox.classList.remove('d-none');
			checkbox_input.required = true;

			return;
		}
	}  
	
	if (show_on_phone) {
		if (phone.value) {
			registration_form_checkbox.classList.remove('d-none');
			checkbox_input.required = true;

			return;
		}
	} 

	registration_form_checkbox.classList.add('d-none');
	checkbox_input.required = false;
}

if (wk_delay) {
	setTimeout(function() {
		set_wk_elements();
	}, wk_delay);
} else {
	set_wk_elements();
}
