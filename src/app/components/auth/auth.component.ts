import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
})
export class AuthComponent implements OnInit {
  isLogin = signal(true);
  isLoading = signal(false);
  error = signal('');
  isCheckingAuth = signal(true);

  loginUsername = '';
  loginPassword = '';

  registerUsername = '';
  registerEmail = '';
  registerPassword = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.checkAuth().subscribe((user) => {
      this.isCheckingAuth.set(false);
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  toggleMode(): void {
    this.isLogin.update((v) => !v);
    this.error.set('');
  }

  onLogin(): void {
    if (!this.loginUsername || !this.loginPassword) {
      this.error.set('Please fill in all fields');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    this.authService
      .login({ username: this.loginUsername, password: this.loginPassword })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err.error?.message || 'Login failed. Please try again.');
        },
      });
  }

  onRegister(): void {
    if (!this.registerUsername || !this.registerEmail || !this.registerPassword) {
      this.error.set('Please fill in all fields');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    this.authService
      .register({
        username: this.registerUsername,
        email: this.registerEmail,
        userPassword: this.registerPassword,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err.error?.message || 'Registration failed. Please try again.');
        },
      });
  }
}
