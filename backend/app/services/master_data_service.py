import re
from datetime import datetime, timedelta, date
from app import db
from app.models.master_data import Category, Priority, SLAPolicy, Department, Status, BreakSetting, Holiday
from app.models.ticket import Ticket

# Valid groups untuk mapping tombol segmented filter Tickets
FILTER_GROUPS = ('new', 'progress', 'done', 'pending')


def _normalize_filter_group(value):
    """Normalisasi input filterGroup ke 'new' | 'progress' | 'done' | 'pending' | None."""
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in FILTER_GROUPS:
        return v
    return None


def _infer_filter_group(name, is_default=False):
    """
    Infer filterGroup otomatis dari nama status (fallback ketika tidak diisi manual).
    - default status atau mengandung 'new' -> 'new'
    - mengandung 'pending'                  -> 'pending'
    - resolve/done/closed/completed       -> 'done'
    - sisanya (assigned, triaged, dll)    -> 'progress'
    """
    lower = str(name or '').lower().strip()
    if is_default or lower == 'new':
        return 'new'
    if 'pending' in lower:
        return 'pending'
    if any(k in lower for k in ('resolve', 'done', 'closed', 'completed')):
        return 'done'
    return 'progress'


class MasterDataService:
    # --- Categories ---
    @staticmethod
    def get_categories():
        return Category.query.all()

    @staticmethod
    def create_category(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Category.query.filter_by(name=data['name']).first():
            return None, 'Category already exists'
            
        category = Category(
            name=data['name'],
            description=data.get('description'),
            is_active=data.get('isActive', True),
            team_id=data.get('teamId') or None
        )
        db.session.add(category)
        db.session.commit()
        return category, None
    
    @staticmethod
    def update_category(id, data):
        category = Category.query.get(id)
        if not category:
            return None, 'Category not found'
        
        if 'name' in data:
            existing = Category.query.filter_by(name=data['name']).first()
            if existing and existing.id != category.id:
                return None, 'Category name already exists'
            category.name = data['name']
            
        if 'description' in data: category.description = data['description']
        if 'isActive' in data: category.is_active = data['isActive']
        if 'teamId' in data: category.team_id = data.get('teamId') or None
        
        db.session.commit()
        return category, None

    @staticmethod
    def delete_category(id):
        category = Category.query.get(id)
        if not category:
            return False
        db.session.delete(category)
        db.session.commit()
        return True

    # --- Priorities ---
    @staticmethod
    def get_priorities():
        return Priority.query.order_by(Priority.level).all()

    @staticmethod
    def create_priority(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Priority.query.filter_by(name=data['name']).first():
            return None, 'Priority name already exists'
            
        priority = Priority(
            name=data['name'],
            level=data.get('level', 5),
            color=data.get('color', '#000000'),
            sla_hours=data.get('slaHours', 24),
            response_time_minutes=data.get('responseTimeMinutes', 60),
            description=data.get('description'),
            is_active=data.get('isActive', True)
        )
        db.session.add(priority)
        db.session.commit()
        return priority, None

    @staticmethod
    def update_priority(id, data):
        priority = Priority.query.get(id)
        if not priority:
            return None, 'Priority not found'
        
        if 'name' in data:
            existing = Priority.query.filter_by(name=data['name']).first()
            if existing and existing.id != priority.id:
                return None, 'Priority name already exists'
            priority.name = data['name']
        if 'level' in data: priority.level = data['level']
        if 'color' in data: priority.color = data['color']
        if 'slaHours' in data: priority.sla_hours = data['slaHours']
        if 'responseTimeMinutes' in data: priority.response_time_minutes = data['responseTimeMinutes']
        if 'description' in data: priority.description = data['description']
        if 'isActive' in data: priority.is_active = data['isActive']
        
        db.session.commit()
        return priority, None

    @staticmethod
    def delete_priority(id):
        priority = Priority.query.get(id)
        if not priority:
            return False
        db.session.delete(priority)
        db.session.commit()
        return True

    # --- SLA Policies ---
    @staticmethod
    def get_sla_policies():
        return SLAPolicy.query.all()

    @staticmethod
    def create_sla_policy(data):
        policy = SLAPolicy(
            priority_id=data.get('priorityId'),
            category_id=data.get('categoryId'),
            response_time_minutes=data.get('responseTimeMinutes', 60),
            resolution_time_hours=data.get('resolutionTimeHours', 24)
        )
        db.session.add(policy)
        db.session.commit()
        return policy, None

    @staticmethod
    def update_sla_policy(id, data):
        policy = SLAPolicy.query.get(id)
        if not policy:
            return None, 'SLA Policy not found'
        
        if 'priorityId' in data: policy.priority_id = data['priorityId']
        if 'categoryId' in data: policy.category_id = data['categoryId']
        if 'responseTimeMinutes' in data: policy.response_time_minutes = data['responseTimeMinutes']
        if 'resolutionTimeHours' in data: policy.resolution_time_hours = data['resolutionTimeHours']
        
        db.session.commit()
        return policy, None

    @staticmethod
    def delete_sla_policy(id):
        policy = SLAPolicy.query.get(id)
        if not policy:
            return False
        db.session.delete(policy)
        db.session.commit()
        return True

    # --- Departments ---
    @staticmethod
    def get_departments(page=None, limit=None):
        query = Department.query.order_by(Department.name)
        if page is not None and limit is not None:
            offset = (page - 1) * limit
            return query.offset(offset).limit(limit).all()
        return query.all()

    @staticmethod
    def create_department(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Department.query.filter_by(name=data['name']).first():
            return None, 'Department name already exists'
        
        if data.get('code') and Department.query.filter_by(code=data['code']).first():
            return None, 'Department code already exists'
            
        department = Department(
            name=data['name'],
            code=data.get('code'),
            description=data.get('description'),
            is_active=data.get('isActive', True)
        )
        db.session.add(department)
        db.session.commit()
        return department, None

    @staticmethod
    def update_department(id, data):
        department = Department.query.get(id)
        if not department:
            return None, 'Department not found'
        
        if 'name' in data:
            existing = Department.query.filter_by(name=data['name']).first()
            if existing and existing.id != department.id:
                return None, 'Department name already exists'
            department.name = data['name']
        
        if 'code' in data:
            existing = Department.query.filter_by(code=data['code']).first()
            if existing and existing.id != department.id:
                return None, 'Department code already exists'
            department.code = data['code']
            
        if 'description' in data: department.description = data['description']
        if 'isActive' in data: department.is_active = data['isActive']
        
        db.session.commit()
        return department, None

    @staticmethod
    def delete_department(id):
        department = Department.query.get(id)
        if not department:
            return False
        db.session.delete(department)
        db.session.commit()
        return True

    # --- Statuses ---
    @staticmethod
    def get_statuses():
        """Get all master data statuses ordered by default status first, then ID"""
        return Status.query.order_by(Status.is_default.desc(), Status.id.asc()).all()

    @staticmethod
    def recompact_status_orders():
        """Ensure all status order numbers are contiguous 1, 2, 3, ..."""
        statuses = Status.query.order_by(Status.order.asc(), Status.id.asc()).all()
        for idx, s in enumerate(statuses):
            s.order = idx + 1
        db.session.commit()

    @staticmethod
    def create_status(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Status.query.filter_by(name=data['name']).first():
            return None, 'Status name already exists'
            
        # If this is set as default, unset others
        if data.get('isDefault'):
            Status.query.update({Status.is_default: False})

        # Calculate next contiguous order if not specified
        order = data.get('order')
        if order is None or int(order) <= 0:
            max_status = Status.query.order_by(Status.order.desc()).first()
            order = (max_status.order + 1) if (max_status and max_status.order) else 1
        else:
            order = int(order)

        status = Status(
            name=data['name'],
            color=data.get('color', '#6B7280'),
            order=order,
            filter_group=_normalize_filter_group(data.get('filterGroup')) if 'filterGroup' in data else _infer_filter_group(data['name'], data.get('isDefault', False)),
            is_default=data.get('isDefault', False),
            requires_reason=data.get('requiresReason', True),
            pauses_sla=data.get('pausesSla', False),
            show_on_devboard=data.get('showOnDevboard', False),
            show_on_it_helpdesk=data.get('showOnItHelpdesk', False),
            team_id=data.get('teamId') or None
        )
        db.session.add(status)
        db.session.commit()
        return status, None

    @staticmethod
    def update_status(id, data):
        status = Status.query.get(id)
        if not status:
            return None, 'Status not found'
        
        if 'name' in data:
            existing = Status.query.filter_by(name=data['name']).first()
            if existing and existing.id != status.id:
                return None, 'Status name already exists'
            status.name = data['name']
            
        if 'color' in data: status.color = data['color']
        if 'order' in data: status.order = data['order']
        if 'filterGroup' in data: status.filter_group = _normalize_filter_group(data['filterGroup'])
        if 'requiresReason' in data: status.requires_reason = data['requiresReason']
        if 'pausesSla' in data: status.pauses_sla = data['pausesSla']
        if 'showOnDevboard' in data: status.show_on_devboard = data['showOnDevboard']
        if 'showOnItHelpdesk' in data: status.show_on_it_helpdesk = data['showOnItHelpdesk']
        if 'teamId' in data: status.team_id = data.get('teamId') or None

        if 'isDefault' in data and data['isDefault']:
            Status.query.update({Status.is_default: False})
            status.is_default = True
        elif 'isDefault' in data:
            status.is_default = False
            
        db.session.commit()
        return status, None

    @staticmethod
    def delete_status(id):
        status = Status.query.get(id)
        if not status:
            return False, 'Status not found'
        
        # Check if status is in use by tickets
        in_use = Ticket.query.filter_by(status=status.name).first()
        if in_use:
            return False, 'Cannot delete status that is currently in use by tickets'
            
        db.session.delete(status)
        db.session.flush()

        # Automatically re-compact order of remaining statuses sequentially (1, 2, 3, ...)
        remaining_statuses = Status.query.order_by(Status.order.asc(), Status.id.asc()).all()
        for idx, s in enumerate(remaining_statuses):
            s.order = idx + 1

        db.session.commit()
        return True, None

    # --- Break Setting (satu baris 'Default', dibuat otomatis) ---
    @staticmethod
    def get_break_setting():
        setting = BreakSetting.query.filter_by(name='Default').first()
        if not setting:
            setting = BreakSetting(
                name='Default', max_break_minutes=60,
                daily_max_minutes=60, weekly_max_minutes=300,
                monthly_max_minutes=1200,
            )
            db.session.add(setting)
            db.session.commit()
        # Backfill kolom periode bila DB lama belum punya nilai (migrasi belum jalan).
        changed = False
        for attr, default in (
            ('daily_max_minutes', 60), ('weekly_max_minutes', 300),
            ('monthly_max_minutes', 1200),
        ):
            if getattr(setting, attr, None) is None:
                setattr(setting, attr, default)
                changed = True
        if getattr(setting, 'max_break_minutes', None) is None:
            setting.max_break_minutes = 60
            changed = True
        if changed:
            db.session.commit()
        return setting

    @staticmethod
    def _parse_break_minutes(data, *keys):
        for k in keys:
            if k in data and data[k] is not None:
                try:
                    return int(data[k]), None
                except (TypeError, ValueError):
                    return None, f'{k} must be a number'
        return None, None

    @staticmethod
    def update_break_setting(data):
        setting = MasterDataService.get_break_setting()
        field_map = (
            ('max_break_minutes', 'maxBreakMinutes', 1, 1440),
            ('daily_max_minutes', 'dailyMaxMinutes', 1, 1440),
            ('weekly_max_minutes', 'weeklyMaxMinutes', 1, 10080),
            ('monthly_max_minutes', 'monthlyMaxMinutes', 1, 43200),
        )
        for column, camel, minimum, maximum in field_map:
            snake = column
            minutes, err = MasterDataService._parse_break_minutes(data, camel, snake)
            if err:
                return None, err
            if minutes is None:
                continue
            if minutes < minimum:
                return None, f'{camel} must be >= {minimum}'
            if minutes > maximum:
                return None, f'{camel} maksimal {maximum}'
            setattr(setting, column, minutes)
        if 'description' in data:
            setting.description = data['description']
        db.session.commit()
        return setting, None

    # --- Holidays ---

    @staticmethod
    def get_holidays():
        """
        Get all public holidays ordered by date.
        Never calls external API on normal requests.
        If table is empty, seeds from the local project file (backend/app/data/holidays_indonesia.json).
        """
        try:
            count = Holiday.query.count()
            if count == 0:
                MasterDataService.seed_holidays_from_local_json()
        except Exception as e:
            print(f"Error checking/seeding holidays: {e}")
        return Holiday.query.order_by(Holiday.holiday_date.asc()).all()

    @staticmethod
    def seed_holidays_from_local_json():
        """Seed holidays from persistent project file backend/app/data/holidays_indonesia.json"""
        import os
        import json
        json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'holidays_indonesia.json')
        if not os.path.exists(json_path):
            return 0
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
            items = content.get('holidays', []) if isinstance(content, dict) else content
            added = 0
            existing_dates = {h.holiday_date for h in Holiday.query.all()}
            for item in items:
                d_str = item.get('holidayDate') or item.get('date')
                name = item.get('name')
                if not d_str or not name:
                    continue
                h_date = datetime.strptime(d_str, '%Y-%m-%d').date()
                if h_date not in existing_dates:
                    db.session.add(Holiday(name=name, holiday_date=h_date, is_recurring=False))
                    existing_dates.add(h_date)
                    added += 1
            db.session.commit()
            print(f"Seeded {added} holidays from local project file {json_path}")
            return added
        except Exception as e:
            print(f"Error seeding holidays from local JSON: {e}")
            return 0

    @staticmethod
    def _save_holidays_to_local_json():
        """Persist current holidays in database to local JSON file for project backup."""
        import os
        import json
        try:
            all_holidays = Holiday.query.order_by(Holiday.holiday_date.asc()).all()
            data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
            os.makedirs(data_dir, exist_ok=True)
            json_file = os.path.join(data_dir, 'holidays_indonesia.json')
            payload = {
                "description": "Hari Libur Nasional & Cuti Bersama Indonesia (api.co.id)",
                "source": "https://use.api.co.id",
                "last_synced_at": datetime.now().isoformat(),
                "cron_schedule": "Setiap 31 Desember 23:59 WIB (Tahunan)",
                "total_holidays": len(all_holidays),
                "holidays": [h.to_dict() for h in all_holidays]
            }
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning: Failed to persist holidays to local JSON file: {e}")

    @staticmethod
    def get_holiday_sync_metadata():
        """Read sync metadata from backend/app/data/holidays_indonesia.json"""
        import os
        import json
        json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'holidays_indonesia.json')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                return {
                    'source': content.get('source', 'https://use.api.co.id'),
                    'lastSyncedAt': content.get('last_synced_at'),
                    'cronSchedule': content.get('cron_schedule', 'Setiap 31 Desember 23:59 WIB (Tahunan)'),
                    'totalHolidays': content.get('total_holidays', Holiday.query.count()),
                    'storageMode': 'Local Project Storage (JSON & PostgreSQL)'
                }
            except Exception:
                pass
        return {
            'source': 'https://use.api.co.id',
            'lastSyncedAt': None,
            'cronSchedule': 'Setiap 31 Desember 23:59 WIB (Tahunan)',
            'totalHolidays': Holiday.query.count(),
            'storageMode': 'Local Project Storage (JSON & PostgreSQL)'
        }

    @staticmethod
    def sync_holidays_from_api(target_years=None):
        """
        Fetch public holidays and collective leave from Indonesian Holiday API:
        Primary: https://use.api.co.id/holidays/indonesia (api.co.id)
        Fallback 1: https://titimangsa.sangkan.dev/v1/holidays?year={year}
        Fallback 2: https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.min.json
        and sync them into the Holiday table and backend/app/data/holidays_indonesia.json.
        """
        import os
        import urllib.request
        import json

        base_url = os.getenv('HOLIDAY_API_BASE_URL', 'https://use.api.co.id').rstrip('/')
        api_key = os.getenv('HOLIDAY_API_KEY', '8e6OfjeYSpBOQ0of7V3WL37kPbJpc8PqN2ZIfmqfJ3FT9cl4et')

        if not target_years:
            curr_year = datetime.now().year
            target_years = [curr_year - 1, curr_year, curr_year + 1]

        holidays_map = {}

        # 1. Primary: api.co.id Indonesian Holidays API
        if api_key:
            for y in target_years:
                try:
                    url = f"{base_url}/holidays/indonesia?year={y}"
                    req = urllib.request.Request(url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'x-api-co-id': api_key
                    })
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        res = json.loads(resp.read().decode('utf-8'))
                        if res.get('is_success') and isinstance(res.get('data'), list):
                            for item in res.get('data', []):
                                # Ambil hari libur resmi/cuti bersama (is_active=True) dan hari nasional/observance (is_active=False)
                                d_str = item.get('date')
                                name = item.get('name')
                                if d_str and name:
                                    is_real_holiday = (item.get('is_holiday') is True or item.get('is_joint_holiday') is True)
                                    is_observance = item.get('is_observance') is True or item.get('type') == 'Observance'
                                    is_active = True if (is_real_holiday and not is_observance) else False
                                    holidays_map[d_str] = (str(name).strip(), is_active)
                except Exception as e:
                    print(f"api.co.id fetch failed for year {y}: {e}")

        # 2. Secondary Fallback: Titimangsa API
        if not holidays_map:
            for y in target_years:
                try:
                    url = f"https://titimangsa.sangkan.dev/v1/holidays?year={y}"
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        payload = json.loads(resp.read().decode('utf-8'))
                        for item in payload.get('data', []):
                            d_str = item.get('date')
                            name = item.get('localName') or item.get('name')
                            if d_str and name:
                                holidays_map[d_str] = str(name).strip()
                except Exception:
                    pass

        # 3. Tertiary Fallback: Guangrei APIHariLibur
        if not holidays_map:
            try:
                url = "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.min.json"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    for d_str, val in data.items():
                        if isinstance(val, dict) and val.get('holiday') is True:
                            summary_list = val.get('summary', [])
                            name = summary_list[0] if summary_list else None
                            if d_str not in holidays_map and name:
                                holidays_map[d_str] = str(name).strip()
            except Exception:
                pass

        if not holidays_map:
            return 0, "Gagal mengambil data dari API hari libur (koneksi terputus atau API tidak merespons)."

        existing_holidays = {h.holiday_date: h for h in Holiday.query.all()}
        count_added = 0
        count_updated = 0
        for d_str, val in holidays_map.items():
            try:
                h_date = datetime.strptime(d_str, '%Y-%m-%d').date()
            except ValueError:
                continue

            name = val[0] if isinstance(val, (tuple, list)) else val
            is_active = val[1] if isinstance(val, (tuple, list)) and len(val) > 1 else True

            existing = existing_holidays.get(h_date)
            if existing:
                if existing.name != name:
                    existing.name = name
                    count_updated += 1
                # Jangan overwrite is_active jika sudah pernah disesuaikan oleh admin
            else:
                new_h = Holiday(
                    name=name,
                    holiday_date=h_date,
                    is_recurring=False,
                    is_active=is_active
                )
                db.session.add(new_h)
                existing_holidays[h_date] = new_h
                count_added += 1

        db.session.commit()

        MasterDataService._save_holidays_to_local_json()

        return len(holidays_map), None

    @staticmethod
    def create_holiday(data):

        name = data.get('name')

        if not name or not str(name).strip():

            return None, 'Name is required'

        

        name = str(name).strip()

        is_recurring = bool(data.get('isRecurring', False))

        is_active = True
        if 'isActive' in data and data['isActive'] is not None:
            is_active = bool(data['isActive'])
        elif 'is_active' in data and data['is_active'] is not None:
            is_active = bool(data['is_active'])
        elif 'isHoliday' in data and data['isHoliday'] is not None:
            is_active = bool(data['isHoliday'])
        elif 'is_holiday' in data and data['is_holiday'] is not None:
            is_active = bool(data['is_holiday'])



        start_date_str = data.get('startDate') or data.get('start_date') or data.get('holidayDate') or data.get('holiday_date')

        end_date_str = data.get('endDate') or data.get('end_date') or start_date_str



        if not start_date_str:

            return None, 'Holiday date or start date is required'



        try:

            start_date = datetime.strptime(str(start_date_str).strip(), '%Y-%m-%d').date()

        except ValueError:

            return None, 'Start date must be YYYY-MM-DD'



        try:

            end_date = datetime.strptime(str(end_date_str).strip(), '%Y-%m-%d').date() if end_date_str else start_date

        except ValueError:

            return None, 'End date must be YYYY-MM-DD'



        if end_date < start_date:

            return None, 'End date cannot be earlier than start date'



        # If single date

        if start_date == end_date:

            if Holiday.query.filter_by(holiday_date=start_date).first():

                return None, 'Holiday date already exists'



            holiday = Holiday(

                name=name,

                holiday_date=start_date,

                is_recurring=is_recurring,

                is_active=is_active

            )

            db.session.add(holiday)

            db.session.commit()
            MasterDataService._save_holidays_to_local_json()

            return holiday, None



        # Range of dates:

        created_holidays = []

        cur = start_date

        while cur <= end_date:

            existing = Holiday.query.filter_by(holiday_date=cur).first()

            if not existing:

                h = Holiday(

                    name=name,

                    holiday_date=cur,

                    is_recurring=is_recurring,

                    is_active=is_active

                )

                db.session.add(h)

                created_holidays.append(h)

            else:

                existing.name = name

                existing.is_recurring = is_recurring

                created_holidays.append(existing)

            cur += timedelta(days=1)



        db.session.commit()
        MasterDataService._save_holidays_to_local_json()
        return (created_holidays[0] if created_holidays else None), None



    @staticmethod

    def update_holiday(id, data):

        holiday = Holiday.query.get(id)

        if not holiday:

            return None, 'Holiday not found'

        if 'name' in data and data['name']:

            holiday.name = str(data['name']).strip()

        holiday_date_str = data.get('holidayDate') or data.get('holiday_date')

        if holiday_date_str:

            try:

                h_date = datetime.strptime(str(holiday_date_str).strip(), '%Y-%m-%d').date()

                existing = Holiday.query.filter_by(holiday_date=h_date).first()

                if existing and existing.id != holiday.id:

                    return None, 'Holiday date already exists'

                holiday.holiday_date = h_date

            except ValueError:

                return None, 'Holiday date must be YYYY-MM-DD'

        if 'isRecurring' in data and data['isRecurring'] is not None:

            holiday.is_recurring = bool(data['isRecurring'])

        if 'isActive' in data and data['isActive'] is not None:
            holiday.is_active = bool(data['isActive'])
        elif 'is_active' in data and data['is_active'] is not None:
            holiday.is_active = bool(data['is_active'])
        elif 'isHoliday' in data and data['isHoliday'] is not None:
            holiday.is_active = bool(data['isHoliday'])
        elif 'is_holiday' in data and data['is_holiday'] is not None:
            holiday.is_active = bool(data['is_holiday'])

        db.session.commit()
        MasterDataService._save_holidays_to_local_json()
        return holiday, None



    @staticmethod

    def delete_holiday(id):

        holiday = Holiday.query.get(id)

        if not holiday:

            return False

        db.session.delete(holiday)

        db.session.commit()
        MasterDataService._save_holidays_to_local_json()

        return True



